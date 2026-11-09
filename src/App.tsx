import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/contexts/AppContext";
import { Analytics } from '@vercel/analytics/react';


import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Pages. HomePage is the landing route, so it ships in the main bundle;
// the rest are split into their own chunks and loaded on navigation.
import HomePage from "./pages/HomePage";
const AuthPage = lazy(() => import("./pages/AuthPage"));
const SubletDetailPage = lazy(() => import("./pages/SubletDetailPage"));
const CreateSubletPage = lazy(() => import("./pages/CreateSubletPage"));
const EditSubletPage = lazy(() => import("./pages/EditSubletPage"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ConfirmPage = lazy(() => import("./pages/ConfirmPage"));
const SavedListingsPage = lazy(() => import("./pages/SavedListingsPage"));

const PageFallback = () => (
  <div className="flex min-h-screen items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-neu-red" />
  </div>
);

// Create a client
const queryClient = new QueryClient();

const App = () => {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <Analytics />
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/create" element={<CreateSubletPage />} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/messages/:userId" element={<MessagesPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/sublet/:subletId" element={<SubletDetailPage />} />
                <Route path="/edit/:subletId" element={<EditSubletPage />} />
                <Route path="/confirm" element={<ConfirmPage />} />
                <Route path="/saved-listings" element={<SavedListingsPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </TooltipProvider>
        </AppProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

export default App;
