import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Inbox } from "@talkjs/react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { talkAppId } from "@/components/TalkSession";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";

const MessagesPage = () => {
  const { userId } = useParams<{ userId?: string }>();
  const { currentUser, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [conversationId, setConversationId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!isLoadingAuth && !currentUser) {
      navigate("/auth", { state: { fromProtected: true } });
    }
  }, [isLoadingAuth, currentUser, navigate]);

  useEffect(() => {
    if (!currentUser) return;
    if (!userId || userId === currentUser.id) {
      setConversationId(null);
      return;
    }
    let cancelled = false;
    setConversationId(undefined);
    supabase.functions
      .invoke("talkjs", { body: { otherUserId: userId } })
      .then(({ data, error }) => {
        if (error) console.error("Failed to open conversation:", error);
        if (!cancelled) setConversationId(data?.conversationId ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, currentUser]);

  if (!currentUser) return null;

  return (
    <div className={`flex flex-col h-[100dvh] ${!isMobile ? "pb-16" : ""}`}>
      <Header title="Messages" />
      <main className="flex-1 min-h-0">
        {!talkAppId ? (
          <p className="p-8 text-center text-gray-500">Messaging is not configured.</p>
        ) : conversationId !== undefined && (
          <Inbox
            conversationId={conversationId}
            style={{ width: "100%", height: "100%" }}
            loadingComponent={<p className="p-8 text-center text-gray-500">Loading messages…</p>}
          />
        )}
      </main>
      {!isMobile && <BottomNav />}
    </div>
  );
};

export default MessagesPage;
