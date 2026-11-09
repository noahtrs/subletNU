import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMessage } from "@/contexts/MessageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Message } from "@/types";
import BottomNav from "@/components/BottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import Header from "@/components/Header";

type Profile = Pick<Tables<"profiles">, "id" | "first_name" | "last_name" | "email">;

const displayName = (p?: Profile) =>
  p ? [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email.split("@")[0] : "Unknown User";

const initials = (p?: Profile) =>
  p ? ((p.first_name?.[0] ?? "") + (p.last_name?.[0] ?? "") || p.email[0]).toUpperCase() : "...";

const MessagesPage = () => {
  const { userId: activeUser } = useParams<{ userId?: string }>();
  const { currentUser, isLoadingAuth } = useAuth();
  const { messages, sendMessage, markMessagesAsRead } = useMessage();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  const [newMessage, setNewMessage] = useState("");
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});

  const subletId = location.state?.subletId;
  const me = currentUser?.id;

  const conversations = useMemo(() => {
    const byContact = new Map<string, { id: string; lastMessage: Message; unread: number }>();
    for (const msg of messages) {
      if (msg.senderId === msg.receiverId) continue;
      const id = msg.senderId === me ? msg.receiverId : msg.senderId;
      const unread = (byContact.get(id)?.unread ?? 0) + (msg.receiverId === me && !msg.isRead ? 1 : 0);
      byContact.set(id, { id, lastMessage: msg, unread });
    }
    return [...byContact.values()].sort(
      (a, b) => new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime()
    );
  }, [messages, me]);

  const thread = messages.filter(
    (msg) =>
      (msg.senderId === me && msg.receiverId === activeUser) ||
      (msg.senderId === activeUser && msg.receiverId === me)
  );
  const activeUnread = conversations.find((c) => c.id === activeUser)?.unread ?? 0;

  const missingProfileIds = [...new Set([...conversations.map((c) => c.id), ...(activeUser ? [activeUser] : [])])]
    .filter((id) => !profiles[id])
    .join(",");

  useEffect(() => {
    if (!missingProfileIds) return;
    supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", missingProfileIds.split(","))
      .then(({ data, error }) => {
        if (error) return console.error("Failed to fetch profiles:", error);
        setProfiles((prev) => ({ ...prev, ...Object.fromEntries(data.map((p) => [p.id, p])) }));
      });
  }, [missingProfileIds]);

  useEffect(() => {
    if (activeUser && activeUnread > 0) markMessagesAsRead(activeUser);
  }, [activeUser, activeUnread, markMessagesAsRead]);

  useEffect(() => {
    if (!isLoadingAuth && !currentUser) {
      navigate("/auth", { state: { fromProtected: true } });
    }
  }, [isLoadingAuth, currentUser, navigate]);

  useEffect(() => {
    if (activeUser && activeUser === me) navigate("/messages");
  }, [activeUser, me, navigate]);

  if (!currentUser || activeUser === me) return null;

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUser || !newMessage.trim()) return;
    sendMessage(activeUser, newMessage);
    setNewMessage("");
  };

  const bottomNav = !isMobile && (
    <div className="sticky bottom-0 z-50">
      <BottomNav />
    </div>
  );

  if (!activeUser) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Messages" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4">
            {conversations.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No conversations yet.</p>
                <p className="text-gray-500">
                  Start by messaging a sublet poster from the listings.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.map(({ id, lastMessage, unread }) => (
                  <button
                    key={id}
                    className="w-full p-4 bg-white rounded-lg shadow flex items-center hover:bg-gray-50"
                    onClick={() => navigate(`/messages/${id}`, { state: { subletId } })}
                  >
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-neu-gold flex items-center justify-center text-white font-bold">
                        {initials(profiles[id])}
                      </div>
                      {unread > 0 && (
                        <div className="absolute -top-1 -right-1 bg-neu-red text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {unread}
                        </div>
                      )}
                    </div>
                    <div className="ml-3 flex-1 text-left">
                      <div className="flex justify-between items-start">
                        <p className={`font-medium ${unread > 0 ? "text-neu-red" : ""}`}>
                          {displayName(profiles[id])}
                        </p>
                        <span className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(lastMessage.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                      <p className={`text-sm truncate ${unread > 0 ? "text-black font-medium" : "text-gray-500"}`}>
                        {lastMessage.senderId === me ? "You: " : ""}
                        {lastMessage.text}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </main>
        {bottomNav}
      </div>
    );
  }

  const backButton = (
    <button
      className="mr-2 p-2 rounded focus:outline-none focus:ring-2 focus:ring-white text-white hover:bg-neu-red/80"
      onClick={() => navigate(subletId ? `/sublet/${subletId}` : "/messages")}
      aria-label="Back"
    >
      <ArrowLeft />
    </button>
  );

  return (
    <div className="flex flex-col min-h-screen">
      <Header title={displayName(profiles[activeUser])} left={!isMobile ? backButton : undefined} />
      <main className="flex-1 overflow-y-auto">
        <div className="min-h-screen flex flex-col mx-auto w-full max-w-7xl bg-gray-100">
          <div className="flex-1 overflow-y-auto p-4 pb-[120px] space-y-3 bg-gray-50">
            {thread.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No messages yet.</p>
                <p className="text-gray-500">Send a message to start the conversation.</p>
              </div>
            ) : (
              thread.map((msg) => (
                <div
                  key={msg.id}
                  className={`max-w-[75%] p-3 rounded-lg shadow-sm ${msg.senderId === me
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
      {bottomNav}
    </div>
  );
};

export default MessagesPage;
