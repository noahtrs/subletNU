import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { Message } from "../types";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "./AuthContext";

type MessageContextType = {
  messages: Message[];
  unreadCount: number;
  sendMessage: (receiverId: string, text: string) => Promise<void>;
  markMessagesAsRead: (senderId: string) => Promise<void>;
};

const MessageContext = createContext<MessageContextType | undefined>(undefined);

const toMessage = (row: Tables<"messages">): Message => ({
  id: row.id,
  senderId: row.sender_id,
  receiverId: row.receiver_id,
  text: row.text,
  timestamp: row.created_at,
  isRead: row.is_read,
});

export const MessageProvider = ({ children }: { children: ReactNode }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const { currentUser } = useAuth();
  const userId = currentUser?.id;

  const addMessage = (message: Message) =>
    setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));

  useEffect(() => {
    setMessages([]);
    if (!userId) return;
    let cancelled = false;

    const channel = supabase
      .channel(`messages:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${userId}` },
        (payload) => addMessage(toMessage(payload.new as Tables<"messages">))
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `receiver_id=eq.${userId}` },
        (payload) => {
          const updated = toMessage(payload.new as Tables<"messages">);
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        }
      )
      .subscribe();

    supabase
      .from("messages")
      .select("*")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to fetch messages:", error);
          toast({ title: "Error", description: "Could not load messages.", variant: "destructive" });
          return;
        }
        const fetched = data.map(toMessage).reverse();
        const fetchedIds = new Set(fetched.map((m) => m.id));
        setMessages((prev) => [...fetched, ...prev.filter((m) => !fetchedIds.has(m.id))]);
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const sendMessage = useCallback(async (receiverId: string, text: string) => {
    if (!userId || !text.trim()) return;

    const { data, error } = await supabase
      .from("messages")
      .insert({ sender_id: userId, receiver_id: receiverId, text: text.trim() })
      .select()
      .single();

    if (error) {
      console.error("Failed to send message:", error);
      toast({ title: "Error", description: "Failed to send message.", variant: "destructive" });
      return;
    }

    addMessage(toMessage(data));

    const { error: notifyError } = await supabase.functions.invoke("send-message-notification", {
      body: { messageId: data.id },
    });
    if (notifyError) console.error("Failed to trigger notification:", notifyError);
  }, [userId]);

  const markMessagesAsRead = useCallback(async (senderId: string) => {
    if (!userId) return;

    const { error } = await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("sender_id", senderId)
      .eq("receiver_id", userId)
      .eq("is_read", false);

    if (error) {
      console.error("Failed to mark messages as read:", error);
      return;
    }

    setMessages((prev) =>
      prev.map((m) => (m.senderId === senderId && m.receiverId === userId ? { ...m, isRead: true } : m))
    );
  }, [userId]);

  const unreadCount = messages.filter((m) => m.receiverId === userId && !m.isRead).length;

  return (
    <MessageContext.Provider value={{ messages, unreadCount, sendMessage, markMessagesAsRead }}>
      {children}
    </MessageContext.Provider>
  );
};

export const useMessage = () => {
  const context = useContext(MessageContext);
  if (context === undefined) {
    throw new Error("useMessage must be used within a MessageProvider");
  }
  return context;
};
