import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/BottomNav";
import ProfileListingCard from "@/components/ProfileListingCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2, User, Trash2, Menu as MenuIcon, Home, PlusCircle, MessageSquare } from "lucide-react";
import { Sublet } from "../types";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Drawer, DrawerContent, DrawerHeader } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import Header from "@/components/Header";
import { Switch } from "@/components/ui/switch";

const ProfilePage = () => {
  const { currentUser, isLoadingAuth, logout } = useAuth();
  const [myListings, setMyListings] = useState<Sublet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<{
    first_name: string | null,
    last_name: string | null,
    notify_new_listings: boolean
  } | null>(null);
  const [savingNotificationPreference, setSavingNotificationPreference] = useState(false);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!currentUser) {
      navigate('/auth', { state: { fromProtected: true } });
    } else {
      fetchMyListings();
      fetchUserProfile();
    }
  }, [currentUser, isLoadingAuth, navigate]);

  const fetchUserProfile = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, notify_new_listings')
        .eq('id', currentUser.id)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return;
      }

      if (data) {
        setUserProfile({
          ...data,
          notify_new_listings: data.notify_new_listings !== false // Default to true if null
        });
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    }
  };

  const fetchMyListings = async () => {
    if (!currentUser) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('sublets')
        .select(`
          *,
          instagram_handle,
          snapchat_handle
        `)
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching my listings:', error);
        toast({
          title: "Error",
          description: "Failed to load your listings",
          variant: "destructive",
        });
        return;
      }

      if (data) {
        const mySublets: Sublet[] = data.map(item => ({
          id: item.id,
          userId: item.user_id,
          userEmail: currentUser.email,
          price: item.price,
          location: item.location,
          distanceFromNEU: item.distance_from_neu,
          startDate: item.start_date,
          endDate: item.end_date,
          description: item.description,
          photos: item.photos,
          createdAt: item.created_at,
          genderPreference: item.gender_preference as "male" | "female" | "any",
          pricingType: item.pricing_type as "firm" | "negotiable",
          amenities: item.amenities || [],
          noBrokersFee: item.no_brokers_fee || false,
          instagramHandle: item.instagram_handle,
          snapchatHandle: item.snapchat_handle,
        }));

        setMyListings(mySublets);
      }
    } catch (error) {
      console.error('Failed to fetch my listings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteListing = async (subletId: string) => {
    if (!window.confirm("Are you sure you want to delete this listing?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from('sublets')
        .delete()
        .eq('id', subletId);

      if (error) {
        console.error('Error deleting listing:', error);
        toast({
          title: "Error",
          description: "Failed to delete listing",
          variant: "destructive",
        });
        return;
      }

      // Update local state
      setMyListings(myListings.filter(listing => listing.id !== subletId));

      toast({
        title: "Success",
        description: "Listing deleted successfully",
      });
    } catch (error) {
      console.error('Failed to delete listing:', error);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("Are you sure you want to delete your account? This action is irreversible and will delete all your data, including listings.")) {
      return;
    }

    if (!currentUser) {
      toast({ title: "Error", description: "You must be logged in to delete your account.", variant: "destructive" });
      return;
    }

    // Indicate loading state
    toast({
      title: "Deleting Account...",
      description: "Please wait while we process your request.",
    });

    try {
      // Call the Supabase Edge Function
      const { error: functionError } = await supabase.functions.invoke('delete-user', {
        // No body needed as the function gets the user from the auth context
      });

      if (functionError) {
        console.error('Error invoking delete-user function:', functionError);
        throw new Error(functionError.message || 'Failed to call delete function.');
      }

      // If the function call succeeds, Supabase handles auth deletion.
      // Log the user out on the client-side and redirect.
      await logout(); // Ensure local session is cleared
      navigate('/auth');
      toast({
        title: "Account Deleted",
        description: "Your account and associated data have been successfully deleted.",
      });

    } catch (error: any) {
      console.error('Failed to delete account:', error);
      toast({
        title: "Error Deleting Account",
        description: error.message || "An unexpected error occurred. Please try again later.",
        variant: "destructive",
      });
    }
  };

  const updateNotificationPreference = async (notify: boolean) => {
    if (!currentUser) return;

    setSavingNotificationPreference(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ notify_new_listings: notify })
        .eq('id', currentUser.id);

      if (error) {
        console.error('Error updating notification preference:', error);
        toast({
          title: "Error",
          description: "Failed to update notification preference",
          variant: "destructive",
        });
        return;
      }

      setUserProfile(prev => prev ? { ...prev, notify_new_listings: notify } : null);

      toast({
        title: "Success",
        description: `You will ${notify ? 'now' : 'no longer'} receive new listing notifications`,
      });
    } catch (error) {
      console.error('Failed to update notification preference:', error);
    } finally {
      setSavingNotificationPreference(false);
    }
  };

  if (!currentUser) return null;

  const getDisplayName = () => {
    if (userProfile?.first_name && userProfile?.last_name) {
      return `${userProfile.first_name} ${userProfile.last_name}`;
    } else if (userProfile?.first_name) {
      return userProfile.first_name;
    } else if (userProfile?.last_name) {
      return userProfile.last_name;
    }
    return "Anonymous User";
  };

  const getInitials = () => {
    const firstName = userProfile?.first_name || '';
    const lastName = userProfile?.last_name || '';
    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || currentUser.email.charAt(0).toUpperCase();
  };

  const logoutButton = (
    <button
      className="ml-4 p-2 rounded focus:outline-none focus:ring-2 focus:ring-white text-white hover:bg-red-800"
      onClick={handleLogout}
      aria-label="Log out"
    >
      <LogOut size={18} className="mr-2 inline" /> Log out
    </button>
  );

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Profile" right={!isMobile ? logoutButton : undefined} />
      <main className="flex-1 overflow-y-auto">
        <div className="pb-20 mx-auto w-full max-w-[90%] md:max-w-4xl lg:max-w-6xl">
          <div className="p-4 md:p-6 lg:p-8">
            <div className="max-w-3xl mx-auto">
              <div className="mb-6 flex items-center">
                <div className="h-16 w-16 mr-4 flex items-center justify-center bg-gray-200 rounded-full">
                  <span className="text-xl font-semibold text-gray-600">{getInitials()}</span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{getDisplayName()}</h2>
                  <p className="text-gray-600">{currentUser.email}</p>
                </div>
              </div>

              <Tabs defaultValue="listings" className="w-full">
                <TabsList className="w-full mb-4">
                  <TabsTrigger value="listings" className="flex-1">My Listings</TabsTrigger>
                  <TabsTrigger value="settings" className="flex-1">Account Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="listings">
                  <div className="my-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium">Your Sublet Listings</h3>
                      <Button
                        onClick={() => navigate('/create')}
                        className="bg-neu-red hover:bg-red-800"
                      >
                        Create New Listing
                      </Button>
                    </div>

                    {isLoading ? (
                      <div className="flex justify-center items-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-neu-red" />
                      </div>
                    ) : myListings.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-lg">
                        <p className="text-gray-500">You haven't posted any listings yet.</p>
                        <Button
                          onClick={() => navigate('/create')}
                          className="mt-4 bg-neu-red hover:bg-red-800"
                        >
                          Create Your First Listing
                        </Button>
                      </div>
                    ) : (
                      <div>
                        {myListings.map((listing) => (
                          <ProfileListingCard
                            key={listing.id}
                            sublet={listing}
                            onDelete={handleDeleteListing}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="settings">
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-medium mb-2">Personal Information</h3>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <p className="text-xs text-gray-500">First Name</p>
                          <p className="text-sm">{userProfile?.first_name || 'Not set'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Last Name</p>
                          <p className="text-sm">{userProfile?.last_name || 'Not set'}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Email Address</p>
                        <p className="text-sm">{currentUser.email}</p>
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <h3 className="font-medium mb-2">Email Verification</h3>
                      <p className="text-xs text-gray-500 mb-2">
                        {currentUser.verified ?
                          "Your email has been verified." :
                          "Please check your inbox to verify your email address."
                        }
                      </p>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <h3 className="font-medium mb-2">Notification Preferences</h3>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm">New listing notifications</p>
                          <p className="text-xs text-gray-500 mb-2">
                            Receive email notifications when new sublets are posted
                          </p>
                        </div>
                        <Switch
                          checked={userProfile?.notify_new_listings ?? true}
                          onCheckedChange={updateNotificationPreference}
                          disabled={savingNotificationPreference}
                          className="data-[state=checked]:bg-neu-red"
                        />
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <h3 className="font-medium mb-2">Account Actions</h3>
                      <Button
                        variant="destructive"
                        onClick={handleLogout}
                      >
                        <LogOut size={16} className="mr-2" />
                        Sign Out
                      </Button>
                    </div>

                    <div className="p-4 border rounded-lg bg-red-50">
                      <h3 className="font-medium mb-2 text-red-700">Danger Zone</h3>
                      <p className="text-sm text-red-600 mb-3">This action cannot be undone. All your data will be permanently deleted.</p>
                      <Button
                        variant="destructive"
                        onClick={handleDeleteAccount}
                        className="w-full bg-red-600 hover:bg-red-700"
                      >
                        <Trash2 size={16} className="mr-2" />
                        Delete Account
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </main>
      {/* Bottom Navigation for Desktop/Tablet */}
      {!isMobile && (
        <div className="sticky bottom-0 z-50">
          <BottomNav />
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
