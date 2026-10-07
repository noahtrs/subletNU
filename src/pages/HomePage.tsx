import { useAuth } from "@/contexts/AuthContext";
import { useFilter } from "@/contexts/FilterContext";
import FilterBar from "@/components/FilterBar";
import SubletCard from "@/components/SubletCard";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import BottomNav from "@/components/BottomNav";
import { Drawer, DrawerContent, DrawerHeader } from "@/components/ui/drawer";
import { Menu as MenuIcon, Home, PlusCircle, MessageSquare, User } from "lucide-react";
import { useState } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

const HomePage = () => {
  const { currentUser } = useAuth();
  const { filteredSublets, isLoading } = useFilter();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    // Remove redirect for unauthenticated users
    // if (!currentUser) {
    //   navigate('/auth');
    // }
  }, [currentUser, navigate]);

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Home" />
      <main className={`flex-1 overflow-y-auto ${!isMobile ? 'pb-20' : ''}`}>
        <div className="mx-auto w-full max-w-[90%] md:max-w-4xl lg:max-w-6xl">
          <FilterBar />
          <div className="mt-4 pb-4">
            {isLoading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-neu-red" />
              </div>
            ) : filteredSublets.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No sublets match your filters.</p>
                <p className="text-gray-500">Try adjusting your filters or check back later.</p>
              </div>
            ) : (
              <div className="lg:grid lg:grid-cols-3 lg:gap-6">
                <AnimatePresence initial={false}>
                  {filteredSublets.map((sublet) => (
                    <motion.div
                      key={sublet.id}
                      layoutId={`sublet-card-${sublet.id}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/sublet/${sublet.id}`)}
                    >
                      <SubletCard sublet={sublet} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
          {/* CTA Section */}
          <div className="mt-8 py-6 text-center border-t border-gray-200">
            <h3 className="text-lg font-semibold mb-2 text-gray-700">Want to list your own sublet?</h3>
            <Button
              onClick={() => navigate('/create')}
              className="bg-neu-red hover:bg-neu-red/90"
            >
              Post Your Sublet
            </Button>
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

export default HomePage;
