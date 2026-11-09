import { Home, PlusCircle, MessageSquare, User, Heart } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMessage } from "@/contexts/MessageContext";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { getTotalUnreadCount } = useMessage();
  const pathname = location.pathname;

  const totalUnreadCount = getTotalUnreadCount();

  return (
    <div className="bottom-nav">
      <button
        className={`nav-item ${pathname === '/' ? 'active' : ''}`}
        onClick={() => navigate('/')}
      >
        <Home size={24} />
        <span className="text-xs mt-1">Home</span>
      </button>

      <button
        className={`nav-item ${pathname === '/create' ? 'active' : ''}`}
        onClick={() => navigate('/create')}
      >
        <PlusCircle size={24} />
        <span className="text-xs mt-1">Post</span>
      </button>

      <button
        className={`nav-item relative ${pathname.startsWith('/messages') ? 'active' : ''}`}
        onClick={() => navigate('/messages')}
      >
        <MessageSquare size={24} />
        <span className="text-xs mt-1">Messages</span>
        {totalUnreadCount > 0 && (
          <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-neu-red ring-2 ring-white" />
        )}
      </button>

      <button
        className={`nav-item ${pathname === '/saved-listings' ? 'active' : ''}`}
        onClick={() => navigate('/saved-listings')}
      >
        <Heart size={24} />
        <span className="text-xs mt-1">Saved</span>
      </button>

      <button
        className={`nav-item ${pathname === '/profile' ? 'active' : ''}`}
        onClick={() => navigate('/profile')}
      >
        <User size={24} />
        <span className="text-xs mt-1">Profile</span>
      </button>
    </div>
  );
};

export default BottomNav;
