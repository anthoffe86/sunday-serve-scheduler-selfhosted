import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Schedule from "./pages/Schedule";
import Availability from "./pages/Availability";
import Swaps from "./pages/Swaps";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/admin/AdminDashboard";
import VolunteerManagement from "./pages/admin/VolunteerManagement";
import EventTemplates from "./pages/admin/EventTemplates";
import EventScheduler from "./pages/admin/EventScheduler";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }>
              <Route path="/" element={<Dashboard />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/availability" element={<Availability />} />
              <Route path="/swaps" element={<Swaps />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/volunteers" element={<VolunteerManagement />} />
              <Route path="/admin/templates" element={<EventTemplates />} />
              <Route path="/admin/scheduler" element={<EventScheduler />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
