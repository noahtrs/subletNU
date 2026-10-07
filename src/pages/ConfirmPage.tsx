import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ALLOWED_TYPES: EmailOtpType[] = ["signup", "email", "email_change"];

const ConfirmPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email...");
  const hasVerified = useRef(false);

  useEffect(() => {
    if (hasVerified.current) return;
    hasVerified.current = true;

    const query = new URLSearchParams(location.search);
    const tokenHash = query.get("token_hash");
    const type = (query.get("type") || "email") as EmailOtpType;

    if (!tokenHash || !ALLOWED_TYPES.includes(type)) {
      setStatus("error");
      setMessage("This confirmation link is invalid or out of date. Try logging in, or sign up again to get a new link.");
      return;
    }

    supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then(({ error }) => {
      if (error) {
        setStatus("error");
        setMessage(error.message || "This confirmation link is invalid or has expired.");
        return;
      }
      setStatus("success");
      setMessage("Email confirmed! You're now logged in.");
      setTimeout(() => navigate("/"), 2000);
    });
  }, [location.search, navigate]);

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Email Confirmation</CardTitle>
        </CardHeader>
        <CardContent>
          {status === "loading" && <p>{message}</p>}
          {status === "success" && (
            <>
              <p className="mb-4 text-green-600">{message}</p>
              <button onClick={() => navigate('/')} className="inline-block px-4 py-2 bg-neu-red text-white rounded hover:bg-neu-red/90 transition">Go to Listings</button>
            </>
          )}
          {status === "error" && (
            <>
              <p className="mb-4 text-red-600">{message}</p>
              <button onClick={() => navigate('/auth')} className="inline-block px-4 py-2 bg-neu-red text-white rounded hover:bg-neu-red/90 transition">Back to Login</button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfirmPage;
