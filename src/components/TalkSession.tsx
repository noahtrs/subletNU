import { ReactNode, useCallback } from "react";
import { Session, useUnreads } from "@talkjs/react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const talkAppId = import.meta.env.VITE_TALKJS_APP_ID as string | undefined;

export const TalkSession = ({ children }: { children: ReactNode }) => {
  const { currentUser } = useAuth();

  const tokenFetcher = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("talkjs");
    if (error || !data?.token) throw error ?? new Error("No TalkJS token");
    return data.token as string;
  }, []);

  if (!currentUser || !talkAppId) return <>{children}</>;

  return (
    <Session appId={talkAppId} userId={currentUser.id} tokenFetcher={tokenFetcher}>
      {children}
    </Session>
  );
};

export const useUnreadCount = () =>
  (useUnreads() ?? []).reduce((total, c) => total + c.unreadMessageCount, 0);
