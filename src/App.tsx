import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/contexts/AppContext";
import { Analytics } from '@vercel/analytics/react';


// Pages
import HomePage from "./pages/HomePage";
import AuthPage from "./pages/AuthPage";
import SubletDetailPage from "./pages/SubletDetailPage";
import CreateSubletPage from "./pages/CreateSubletPage";
import EditSubletPage from "./pages/EditSubletPage";
import MessagesPage from "./pages/MessagesPage";
import ProfilePage from "./pages/ProfilePage";
import NotFound from "./pages/NotFound";
import ConfirmPage from "./pages/ConfirmPage";
import SavedListingsPage from "./pages/SavedListingsPage";

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
          </TooltipProvider>
        </AppProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

export default App;
