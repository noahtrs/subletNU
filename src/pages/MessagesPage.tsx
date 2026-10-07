import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSublet } from "@/contexts/SubletContext";
import { useMessage } from "@/contexts/MessageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, MessageSquare, Menu as MenuIcon, Home, PlusCircle, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import { Drawer, DrawerContent, DrawerHeader } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import Header from "@/components/Header";

type UserProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
};

const MessagesPage = () => {
  const { userId } = useParams<{ userId?: string }>();
  const { currentUser, isLoadingAuth } = useAuth();
  const { sublets } = useSublet();
  const {
    messages,
    sendMessage,
    getMessagesForUser,
    getDisplayName,
    getInitials,
    fetchUserProfiles,
    fetchMessages,
    markMessagesAsRead,
    getUnreadCount,
    getTotalUnreadCount,
    isLoadingMessages,
    userProfiles
  } = useMessage();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  const [newMessage, setNewMessage] = useState("");
  const [activeUser, setActiveUser] = useState<string | null>(userId || null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const subletId = location.state?.subletId;

  const totalUnreadCount = getTotalUnreadCount();

  const getUniqueContacts = () => {
    if (!currentUser) return [];

    const uniqueContactIds = new Set<string>();

    messages.forEach(msg => {
      // Skip messages where user is messaging themselves
      if (msg.senderId === msg.receiverId) return;

      if (msg.senderId === currentUser.id) {
        uniqueContactIds.add(msg.receiverId);
      } else if (msg.receiverId === currentUser.id) {
        uniqueContactIds.add(msg.senderId);
      }
    });

    const contacts = Array.from(uniqueContactIds).map(id => {
      const contactMessages = messages.filter(
        msg => (msg.senderId === id && msg.receiverId === currentUser.id) ||
          (msg.receiverId === id && msg.senderId === currentUser.id)
      );

      const lastMessage = contactMessages.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )[0];

      return {
        id,
        lastMessage,
      };
    });

    return contacts.sort((a, b) => {
      if (!a.lastMessage || !b.lastMessage) return 0;
      return new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime();
    });
  };

  const contacts = getUniqueContacts();

  const activeUserMessages = activeUser ? getMessagesForUser(activeUser) : [];
  const activeUserSublet = activeUser ? sublets.find(s => s.userId === activeUser) : null;

  // Prevent self-messaging
  useEffect(() => {
    if (userId === currentUser?.id) {
      navigate('/messages');
    }
  }, [userId, currentUser, navigate]);

  // Update activeUser when userId changes
  useEffect(() => {
    if (userId && userId !== currentUser?.id) {
      setActiveUser(userId);
    } else {
      setActiveUser(null);
    }
  }, [userId, currentUser]);

  useEffect(() => {
    if (!activeUser || activeUser === currentUser?.id) return;
    fetchMessages();
  }, [activeUser, currentUser?.id, fetchMessages]);

  const activeUnreadCount = activeUser ? getUnreadCount(activeUser) : 0;
  useEffect(() => {
    if (activeUser && activeUnreadCount > 0) {
      markMessagesAsRead(activeUser);
    }
  }, [activeUser, activeUnreadCount, markMessagesAsRead]);

  // Fetch missing profiles for contacts
  useEffect(() => {
    const missingContactIds = contacts
      .map(c => c.id)
      .filter(id => !userProfiles[id]);

    if (missingContactIds.length > 0) {
      fetchUserProfiles(missingContactIds);
    }
  }, [contacts, fetchUserProfiles, userProfiles]);

  // Fetch missing profile for active user
  useEffect(() => {
    if (activeUser && !userProfiles[activeUser]) {
      fetchUserProfiles([activeUser]);
    }
  }, [activeUser, fetchUserProfiles, userProfiles]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();

    if (!activeUser || !newMessage.trim()) return;

    sendMessage(activeUser, newMessage);
    setNewMessage("");
  };

  const handleBackClick = () => {
    if (subletId) {
      navigate(`/sublet/${subletId}`);
    } else {
      navigate('/messages');
    }
  };

  useEffect(() => {
    if (!isLoadingAuth && !currentUser) {
      navigate('/auth', { state: { fromProtected: true } });
    }
  }, [isLoadingAuth, currentUser, navigate]);

  if (!currentUser) return null;

  // Prevent rendering if trying to message self
  if (userId === currentUser.id) return null;

  const backButton = (
    <button
      className="mr-2 p-2 rounded focus:outline-none focus:ring-2 focus:ring-white text-white hover:bg-neu-red/80"
      onClick={handleBackClick}
      aria-label="Back"
    >
      <ArrowLeft />
    </button>
  );

  // Show conversation list if no conversation is selected
  if (!activeUser && !userId) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Messages" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4">
            {contacts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No conversations yet.</p>
                <p className="text-gray-500">
                  Start by messaging a sublet poster from the listings.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {contacts.map(contact => {
                  const unreadCount = getUnreadCount(contact.id);
                  return (
                    <button
                      key={contact.id}
                      className="w-full p-4 bg-white rounded-lg shadow flex items-center hover:bg-gray-50"
                      onClick={() => {
                        navigate(`/messages/${contact.id}`, { state: { subletId } });
                      }}
                    >
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-neu-gold flex items-center justify-center text-white font-bold">
                          {getInitials(contact.id)}
                        </div>
                        {unreadCount > 0 && (
                          <div className="absolute -top-1 -right-1 bg-neu-red text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                            {unreadCount}
                          </div>
                        )}
                      </div>
                      <div className="ml-3 flex-1 text-left">
                        <div className="flex justify-between items-start">
                          <p className={`font-medium ${unreadCount > 0 ? 'text-neu-red' : ''}`}>
                            {getDisplayName(contact.id)}
                          </p>
                          {contact.lastMessage && (
                            <span className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(contact.lastMessage.timestamp), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                        {contact.lastMessage && (
                          <p className={`text-sm truncate ${unreadCount > 0 ? 'text-black font-medium' : 'text-gray-500'}`}>
                            {contact.lastMessage.senderId === currentUser.id ? "You: " : ""}
                            {contact.lastMessage.text}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
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
  }

  // Show message thread if a conversation is selected
  return (
    <div className="flex flex-col min-h-screen">
      <Header title={activeUser ? getDisplayName(activeUser) : "Unknown User"} left={!isMobile ? backButton : undefined} />
      <main className="flex-1 overflow-y-auto">
        <div className="min-h-screen flex flex-col mx-auto w-full max-w-7xl bg-gray-100">
          <div className="flex-1 overflow-y-auto p-4 pb-[120px] space-y-3 bg-gray-50">
            {activeUserMessages.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No messages yet.</p>
                <p className="text-gray-500">Send a message to start the conversation.</p>
              </div>
            ) : (
              activeUserMessages.map(msg => (
                <div
                  key={msg.id}
                  className={`max-w-[75%] p-3 rounded-lg shadow-sm ${msg.senderId === currentUser.id
                    ? "bg-neu-red text-white ml-auto"
                    : "bg-white text-black"
                    }`}
                >
                  <p>{msg.text}</p>
                  <p className="text-xs opacity-70 mt-1 text-right">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </p>
                </div>
              ))
            )}
          </div>
          <div className="fixed left-0 right-0 bottom-[56px] z-30 p-3 border-t bg-white max-w-7xl mx-auto w-full">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!newMessage.trim()}
                className="bg-neu-red hover:bg-neu-red/90"
              >
                <Send size={18} />
              </Button>
            </form>
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

export default MessagesPage;
