import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Schedule from "./pages/Schedule";
import Availability from "./pages/Availability";
import Swaps from "./pages/Swaps";
import Profile from "./pages/Profile";
import Invitations from "./pages/Invitations";
import InvitationResponse from "./pages/InvitationResponse";
import AdminDashboard from "./pages/admin/AdminDashboard";
import VolunteerManagement from "./pages/admin/VolunteerManagement";
import AdminSchedule from "./pages/admin/Schedule";
import AdminEvents from "./pages/admin/Events";
import AdminEventDetail from "./pages/admin/EventDetail";
import AdminSwapManagement from "./pages/admin/SwapManagement";
import AdminSettings from "./pages/admin/AdminSettings";
import Auth from "./pages/Auth";
import InviteSignup from "./pages/InviteSignup";
import NotFound from "./pages/NotFound";
const queryClient = new QueryClient();

function UrlNormalizer() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Normalize accidental double slashes in externally shared links
    // e.g. "//respond-invitation" -> "/respond-invitation"
    const normalizedPathname = location.pathname.replace(/\/{2,}/g, "/");
    if (normalizedPathname !== location.pathname) {
      navigate(
        {
          pathname: normalizedPathname,
          search: location.search,
          hash: location.hash,
        },
        { replace: true }
      );
    }
  }, [location.pathname, location.search, location.hash, navigate]);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <UrlNormalizer />
          <Routes>
            {/* Public routes - accessible without authentication */}
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/invite" element={<InviteSignup />} />
            {/* Backwards-compatible alias for older emails */}
            <Route path="/invitation/respond" element={<InvitationResponse />} />
            <Route path="/respond-invitation" element={<InvitationResponse />} />
            
            {/* Protected routes - require authentication */}
            <Route element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/availability" element={<Availability />} />
              <Route path="/swaps" element={<Swaps />} />
              <Route path="/invitations" element={<Invitations />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/volunteers" element={<VolunteerManagement />} />
              <Route path="/admin/schedule" element={<AdminSchedule />} />
              <Route path="/admin/events" element={<AdminEvents />} />
              <Route path="/admin/events/:eventId" element={<AdminEventDetail />} />
              <Route path="/admin/swaps" element={<AdminSwapManagement />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
