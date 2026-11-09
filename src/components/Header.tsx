import { ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Drawer, DrawerContent, DrawerHeader } from "@/components/ui/drawer";
import { Menu as MenuIcon, Home, PlusCircle, MessageSquare, User, Heart } from "lucide-react";
import { useMessage } from "@/contexts/MessageContext";

interface HeaderProps {
  title: string;
  right?: ReactNode;
  left?: ReactNode;
}

const Header = ({ title, right, left }: HeaderProps) => {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const { getTotalUnreadCount } = useMessage();
  const totalUnreadCount = getTotalUnreadCount();

  return (
    <>
      {isMobile ? (
        <header className="bg-neu-red text-white p-4 flex items-center justify-between w-full sticky top-0 z-50" style={{ borderRadius: 0 }}>
          <div className="relative">
            {left ? (
              left
            ) : (
              <button
                className="mr-2 p-2 rounded focus:outline-none focus:ring-2 focus:ring-white relative"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open menu"
              >
                <MenuIcon size={28} />
                {totalUnreadCount > 0 && (
                  <span className="absolute right-1 top-1 block h-2 w-2 rounded-full bg-white ring-2 ring-neu-red" />
                )}
              </button>
            )}
          </div>
          <h1 className="text-xl font-bold flex-1 text-center">{title}</h1>
          <div style={{ width: 40 }}>{right}</div>
        </header>
      ) : (
        <header className="bg-neu-red text-white p-4 flex items-center justify-between w-full sticky top-0 z-50" style={{ borderRadius: 0 }}>
          {left ? <div>{left}</div> : <div style={{ width: 40 }} />}
          <h1 className="text-xl font-bold flex-1 text-center">{title}</h1>
          {right ? <div>{right}</div> : <div style={{ width: 40 }} />}
        </header>
      )}
      {/* Hamburger Drawer for mobile */}
      {isMobile && (
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerContent>
            <DrawerHeader>
              <h2 className="text-lg font-bold mb-4">Menu</h2>
              <nav className="flex flex-col gap-4">
                <button className="flex items-center gap-2 text-left" onClick={() => { setDrawerOpen(false); navigate('/'); }}>
                  <Home size={22} /> Home
                </button>
                <button className="flex items-center gap-2 text-left" onClick={() => { setDrawerOpen(false); navigate('/create'); }}>
                  <PlusCircle size={22} /> Post
                </button>
                <button className="flex items-center gap-2 text-left" onClick={() => { setDrawerOpen(false); navigate('/messages'); }}>
                  <div className="relative">
                    <MessageSquare size={22} />
                    {totalUnreadCount > 0 && (
                      <span className="absolute right-0 top-0 block h-2 w-2 rounded-full bg-white ring-2 ring-neu-red" />
                    )}
                  </div>
                  Messages
                </button>
                <button className="flex items-center gap-2 text-left" onClick={() => { setDrawerOpen(false); navigate('/saved-listings'); }}>
                  <Heart size={22} /> Saved
                </button>
                <button className="flex items-center gap-2 text-left" onClick={() => { setDrawerOpen(false); navigate('/profile'); }}>
                  <User size={22} /> Profile
                </button>
              </nav>
            </DrawerHeader>
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
};

export default Header; 