import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User } from "../types";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser, Session } from "@supabase/supabase-js";
import { toast } from "@/hooks/use-toast";

type AuthContextType = {
  currentUser: User | null;
  supabaseUser: SupabaseUser | null;
  session: Session | null;
  isLoadingAuth: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, metadata?: { first_name?: string; last_name?: string; notify_new_listings?: boolean; captcha_token?: string }) => Promise<boolean>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingAuth(true);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isMounted) {
        setSession(session);
        setSupabaseUser(session?.user ?? null);
        if (session?.user) {
          const appUser: User = {
            id: session.user.id,
            email: session.user.email || "",
            verified: !!session.user.email_confirmed_at
          };
          setCurrentUser(appUser);
        } else {
          setCurrentUser(null);
        }
        setIsLoadingAuth(false);
      }
    }).catch(() => {
      if (isMounted) setIsLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (isMounted) {
          setSession(session);
          const user = session?.user ?? null;
          setSupabaseUser(user);

          if (user) {
            const appUser: User = {
              id: user.id,
              email: user.email || "",
              verified: !!user.email_confirmed_at
            };
            setCurrentUser(appUser);
          } else {
            setCurrentUser(null);
          }
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    if (!email.trim().toLowerCase().endsWith('@northeastern.edu')) {
      toast({
        title: "Invalid Email",
        description: "You must use a northeastern.edu email address.",
        variant: "destructive",
      });
      return false;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error) {
        toast({
          title: "Login Failed",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Login Successful",
        description: "Welcome back to SubletNU!",
      });
      return true;
    } catch (error: any) {
      toast({
        title: "Login Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
      return false;
    }
  };

  const register = async (email: string, password: string, metadata?: { first_name?: string; last_name?: string; notify_new_listings?: boolean; captcha_token?: string }): Promise<boolean> => {
    if (!email.trim().toLowerCase().endsWith('@northeastern.edu')) {
      toast({
        title: "Invalid Email",
        description: "You must use a northeastern.edu email address.",
        variant: "destructive",
      });
      return false;
    }

    // Verify captcha token if provided
    if (metadata?.captcha_token) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        toast({
          title: "Configuration Error",
          description: "Supabase URL is not set. Please contact support.",
          variant: "destructive",
        });
        return false;
      }
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/verify-captcha`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            token: metadata.captcha_token,
          }),
        });

        const result = await response.json();
        if (!result.success) {
          toast({
            title: "Verification Failed",
            description: "Please complete the captcha verification again.",
            variant: "destructive",
          });
          return false;
        }
      } catch (error) {
        toast({
          title: "Verification Error",
          description: "Failed to verify captcha. Please try again.",
          variant: "destructive",
        });
        return false;
      }
    }

    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            first_name: metadata?.first_name,
            last_name: metadata?.last_name,
            notify_new_listings: metadata?.notify_new_listings
          }
        }
      });

      if (error) {
        toast({
          title: "Registration Failed",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Registration Successful",
        description: "Welcome to SubletNU! Please check your email for verification.",
      });
      return true;
    } catch (error: any) {
      toast({
        title: "Registration Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
      return false;
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
    } catch (error: any) {
      toast({
        title: "Logout Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  const value = {
    currentUser,
    supabaseUser,
    session,
    isLoadingAuth,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}; 