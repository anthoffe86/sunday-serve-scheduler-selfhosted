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

  // Super admins are confined to their own area. Match the whole /super-admin
  // subtree, not just the exact path, or the outer AppLayout route (which has no
  // requireSuperAdmin) bounces them off every nested super-admin page. The
  // trailing slash keeps a path like /super-admin-other from matching.
  const inSuperAdminArea =
    location.pathname === '/super-admin' || location.pathname.startsWith('/super-admin/');

  if (isSuperAdmin && !requireSuperAdmin && !inSuperAdminArea) {
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
