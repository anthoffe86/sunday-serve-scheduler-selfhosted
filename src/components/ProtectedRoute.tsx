import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { isSandboxMode } from '@/sandbox/mode';

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
  const sandboxActive = isSandboxMode(location.pathname);

  const spinner = (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (isLoading) {
    return spinner;
  }

  if (!user) {
    // Sandbox mode always resolves a local persona, so a missing user here only
    // means the auth context has not caught up yet. Redirecting would ping-pong
    // /sandbox <-> /sandbox/dashboard forever and render a blank page, so hold
    // on the spinner and let the next render through.
    if (sandboxActive) {
      return spinner;
    }
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
    return <Navigate to={sandboxActive ? '/sandbox/dashboard' : '/dashboard'} replace />;
  }

  if (requireOrgAdmin && (!isAdmin || isSuperAdmin)) {
    return <Navigate to={sandboxActive ? '/sandbox/dashboard' : '/dashboard'} replace />;
  }

  return <>{children}</>;
}
