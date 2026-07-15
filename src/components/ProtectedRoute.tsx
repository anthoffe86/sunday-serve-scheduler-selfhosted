import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOrgAdmin?: boolean;
  requireSuperAdmin?: boolean;
}

export function ProtectedRoute({
  children,
  requireOrgAdmin = false,
  requireSuperAdmin = false,
}: ProtectedRouteProps) {
  const location = useLocation();
  const { user, isLoading, isAdmin, isSuperAdmin } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (isSuperAdmin && !requireSuperAdmin && location.pathname !== '/super-admin') {
    return <Navigate to="/super-admin" replace />;
  }

  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireOrgAdmin && (!isAdmin || isSuperAdmin)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
