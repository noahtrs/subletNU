import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { Message as BaseMessage } from "../types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "./AuthContext";
import { RealtimeChannel } from "@supabase/supabase-js";

type UserProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
};

interface ExtendedMessage extends BaseMessage {
  isRead: boolean;
}

type MessageContextType = {
  messages: ExtendedMessage[];
  isLoadingMessages: boolean;
  userProfiles: Record<string, UserProfile>;
  sendMessage: (receiverId: string, text: string) => void;
  getMessagesForUser: (userId: string) => ExtendedMessage[];
  getDisplayName: (userId: string) => string;
  getInitials: (userId: string) => string;
  fetchUserProfiles: (userIds: string[]) => Promise<void>;
  fetchMessages: () => Promise<void>;
  markMessagesAsRead: (senderId: string) => Promise<void>;
  getUnreadCount: (userId: string) => number;
  getTotalUnreadCount: () => number;
};

const MessageContext = createContext<MessageContextType | undefined>(undefined);

export const MessageProvider = ({ children }: { children: ReactNode }) => {
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({});
  const { currentUser } = useAuth();

  const fetchMessages = useCallback(async () => {
    if (!currentUser) {
      setMessages([]);
      setIsLoadingMessages(false);
      return;
    }

    setIsLoadingMessages(true);
    try {
      // First, get the total count
      const { count, error: countError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);

      if (countError) {
        throw countError;
      }

      // If there are no messages, return early
      if (count === 0) {
        setMessages([]);
        setIsLoadingMessages(false);
        return;
      }

      // Fetch messages in chunks of 50
      const pageSize = 50;
      const pages = Math.ceil(count / pageSize);
      let allMessages: ExtendedMessage[] = [];

      for (let page = 0; page < pages; page++) {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
          .order('created_at', { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
          console.error(`Error fetching messages page ${page}:`, error);
          // Continue with partial data if we have some
          if (allMessages.length > 0) {
            break;
          }
          throw error;
        }

        if (data) {
          const mappedMessages: ExtendedMessage[] = data.map((msg) => ({
            id: msg.id,
            senderId: msg.sender_id,
            receiverId: msg.receiver_id,
            text: msg.text,
            timestamp: msg.created_at,
            isRead: msg.is_read,
          }));
          allMessages = [...allMessages, ...mappedMessages];
        }

        // Small delay between requests to prevent rate limiting
        if (page < pages - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      setMessages(allMessages);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      // Only show error toast if we have no messages
      if (messages.length === 0) {
        toast({
          title: "Error",
          description: "Could not fetch messages. Please try refreshing the page.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoadingMessages(false);
    }
  }, [currentUser]);

  const markMessagesAsRead = useCallback(async (senderId: string) => {
    if (!currentUser) return;

    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('sender_id', senderId)
        .eq('receiver_id', currentUser.id)
        .eq('is_read', false);

      if (error) {
        console.error('Error marking messages as read:', error);
        return;
      }

      setMessages(prev => prev.map(msg =>
        msg.senderId === senderId && msg.receiverId === currentUser.id
          ? { ...msg, isRead: true }
          : msg
      ));
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  }, [currentUser]);

  const getUnreadCount = (userId: string): number => {
    if (!currentUser) return 0;

    return messages.filter(
      msg => msg.senderId === userId &&
        msg.receiverId === currentUser.id &&
        !msg.isRead
    ).length;
  };

  const getTotalUnreadCount = (): number => {
    if (!currentUser) return 0;

    return messages.filter(
      msg => msg.receiverId === currentUser.id && !msg.isRead
    ).length;
  };

  useEffect(() => {
    let messageChannel: RealtimeChannel | null = null;
    let retryCount = 0;
    let retryTimeout: NodeJS.Timeout | null = null;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    const setupSubscription = async () => {
      if (!currentUser) return;

      // Clean up existing subscription if any
      if (messageChannel) {
        await supabase.removeChannel(messageChannel);
        messageChannel = null;
      }

      messageChannel = supabase
        .channel(`messages:${currentUser.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${currentUser.id}`,
        }, (payload) => {
          const newMessage = payload.new as any;
          const mappedMessage: ExtendedMessage = {
            id: newMessage.id,
            senderId: newMessage.sender_id,
            receiverId: newMessage.receiver_id,
            text: newMessage.text,
            timestamp: newMessage.created_at,
            isRead: newMessage.is_read,
          };
          setMessages((prev) =>
            prev.find((m) => m.id === mappedMessage.id) ? prev : [...prev, mappedMessage]
          );
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${currentUser.id}`,
        }, (payload) => {
          const updatedMessage = payload.new as any;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === updatedMessage.id
                ? {
                  ...msg,
                  isRead: updatedMessage.is_read,
                }
                : msg
            )
          );
        });

      try {
        await messageChannel.subscribe((status, err) => {
          if (err) {
            console.error('Error subscribing to messages channel:', err);
            toast({
              title: "Realtime Error",
              description: "Could not connect to messaging service.",
              variant: "destructive",
            });
          } else {
            // Successfully subscribed
          }
        });
        retryCount = 0;

        // Initial fetch of messages
        await fetchMessages();
      } catch (error) {
        console.error('Error in subscription:', error);
        if (retryCount < maxRetries) {
          retryCount++;
          if (retryTimeout) clearTimeout(retryTimeout);
          retryTimeout = setTimeout(setupSubscription, retryDelay * retryCount);
        } else {
          toast({
            title: "Connection Error",
            description: "Could not establish real-time connection. Messages may be delayed.",
            variant: "destructive"
          });
          // Try to fetch messages manually as fallback
          await fetchMessages();
        }
      }
    };

    setupSubscription();

    // Cleanup function
    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      if (messageChannel) {
        supabase.removeChannel(messageChannel);
        messageChannel = null;
      }
    };
  }, [currentUser, fetchMessages]);

  const sendMessage = async (receiverId: string, text: string) => {
    if (!currentUser) {
      toast({
        title: "Error",
        description: "You must be logged in to send messages.",
        variant: "destructive",
      });
      return;
    }
    if (!text.trim()) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUser.id,
          receiver_id: receiverId,
          text: text.trim(),
        })
        .select()
        .single();

      if (error) {
        console.error("Error sending message:", error);
        toast({
          title: "Error",
          description: "Failed to send message.",
          variant: "destructive",
        });
        throw error;
      }

      if (data) {
        const sentMessage: ExtendedMessage = {
          id: data.id,
          senderId: data.sender_id,
          receiverId: data.receiver_id,
          text: data.text,
          timestamp: data.created_at,
          isRead: data.is_read,
        };
        setMessages((prev) =>
          prev.find((m) => m.id === sentMessage.id) ? prev : [...prev, sentMessage]
        );

        const { error: notifyError } = await supabase.functions.invoke('send-message-notification', {
          body: { messageId: data.id },
        });
        if (notifyError) {
          console.error('Failed to trigger notification:', notifyError);
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      if (!(error instanceof Error && (error as any).details)) {
        toast({
          title: "Error",
          description: "An unexpected error occurred while sending the message.",
          variant: "destructive",
        });
      }
    }
  };

  const fetchUserProfiles = useCallback(async (userIds: string[]) => {
    if (!userIds || userIds.length === 0) {
      return;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', userIds);

      if (error) {
        console.error('[fetchUserProfiles] Supabase Error:', error);
        return;
      }

      if (data && data.length > 0) {
        const profiles = data.reduce((acc, profile) => ({
          ...acc,
          [profile.id]: profile
        }), {});
        setUserProfiles(prev => ({ ...prev, ...profiles }));
      }
    } catch (error) {
      console.error('[fetchUserProfiles] Failed to fetch user profiles:', error);
    }
  }, []);

  const getDisplayName = useCallback((userId: string) => {
    const profile = userProfiles[userId];
    if (!profile) return "Unknown User";

    // Removed display_name check, back to original logic
    if (profile.first_name && profile.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    } else if (profile.first_name) {
      return profile.first_name;
    } else if (profile.last_name) {
      return profile.last_name;
    }
    // Fallback to email prefix
    return profile.email.split('@')[0];
  }, [userProfiles]);

  const getInitials = useCallback((userId: string) => {
    const profile = userProfiles[userId];
    if (!profile) return "...";

    if (profile.first_name && profile.last_name) {
      return (profile.first_name[0] + profile.last_name[0]).toUpperCase();
    } else if (profile.first_name) {
      return profile.first_name[0].toUpperCase();
    } else if (profile.last_name) {
      return profile.last_name[0].toUpperCase();
    }
    return profile.email[0].toUpperCase();
  }, [userProfiles]);

  const getMessagesForUser = useCallback((userId: string): ExtendedMessage[] => {
    if (!currentUser) return [];

    return messages.filter(
      (msg) =>
        (msg.senderId === currentUser.id && msg.receiverId === userId) ||
        (msg.senderId === userId && msg.receiverId === currentUser.id)
    ).sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [messages, currentUser]);

  const value = {
    messages,
    isLoadingMessages,
    userProfiles,
    sendMessage,
    getMessagesForUser,
    getDisplayName,
    getInitials,
    fetchUserProfiles,
    fetchMessages,
    markMessagesAsRead,
    getUnreadCount,
    getTotalUnreadCount,
  };

  return <MessageContext.Provider value={value}>{children}</MessageContext.Provider>;
};

export const useMessage = () => {
  const context = useContext(MessageContext);
  if (context === undefined) {
    throw new Error("useMessage must be used within a MessageProvider");
  }
  return context;
}; 