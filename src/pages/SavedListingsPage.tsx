import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSavedListings } from '@/hooks/useSavedListings';
import SubletCard from '@/components/SubletCard';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { Loader2, HeartCrack, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

const SavedListingsPage = () => {
  const { currentUser, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const { savedListings, isLoading, error, refetch } = useSavedListings();

  if (isLoadingAuth || isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Saved Listings" />
        <div className="flex-1 flex flex-col items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-neu-red" />
          <p className="mt-4 text-gray-600">Loading your saved listings...</p>
        </div>
        {!isMobile && <BottomNav />}
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Saved Listings" />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <HeartCrack className="h-16 w-16 text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Please Log In</h2>
          <p className="text-gray-500 mb-6">
            You need to be logged in to view your saved listings.
          </p>
          <Button onClick={() => navigate('/auth')} className="bg-neu-red hover:bg-neu-red/90">
            Log In / Sign Up
          </Button>
        </div>
        {!isMobile && <BottomNav />}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Saved Listings" />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <AlertTriangle className="h-16 w-16 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-red-700 mb-2">Error Loading Listings</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button
            onClick={() => refetch()}
            className="bg-neu-red hover:bg-neu-red/90"
          >
            Try Again
          </Button>
        </div>
        {!isMobile && <BottomNav />}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Saved Listings" />
      <main className={`flex-1 overflow-y-auto ${!isMobile ? 'pb-20' : 'pb-16'}`}>
        <div className="mx-auto w-full max-w-[90%] md:max-w-4xl lg:max-w-6xl py-4">
          {savedListings.length === 0 ? (
            <div className="text-center py-20">
              <HeartCrack className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-700 mb-2">No Saved Listings Yet</h2>
              <p className="text-gray-500 mb-6">
                Start exploring and save listings you're interested in! They'll appear here.
              </p>
              <Button onClick={() => navigate('/')} className="bg-neu-red hover:bg-neu-red/90">
                Find Sublets
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
              {savedListings.map((sublet) => (
                <SubletCard key={sublet.id} sublet={sublet} />
              ))}
            </div>
          )}
        </div>
      </main>
      {!isMobile && (
        <div className="sticky bottom-0 z-50">
          <BottomNav />
        </div>
      )}
    </div>
  );
};

export default SavedListingsPage; 