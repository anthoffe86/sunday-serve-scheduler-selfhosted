import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { isSandboxMode } from '@/sandbox/mode';
import {
  getSandboxAuthContext,
  sandboxSignIn,
  sandboxSignOut,
  sandboxSignUp,
  subscribeSandboxState,
} from '@/sandbox/runtime';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  orgId: string | null;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Read the path from the router rather than window.location so entering or
  // leaving /sandbox re-renders this provider and re-runs the effect below.
  // Reading window.location directly meant a client-side <Link> into /sandbox
  // left the provider stuck in live mode with no user, and every guarded
  // sandbox route redirect-looped instead of rendering.
  const { pathname } = useLocation();
  const sandboxActive = isSandboxMode(pathname);
  const sandboxContext = sandboxActive ? getSandboxAuthContext() : null;

  const [user, setUser] = useState<User | null>(sandboxContext?.user ?? null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(!sandboxActive);
  const [isAdmin, setIsAdmin] = useState(sandboxContext?.isAdmin ?? false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(sandboxContext?.isSuperAdmin ?? false);
  const [orgId, setOrgId] = useState<string | null>(sandboxContext?.orgId ?? null);

  // Live and sandbox reads share query keys ('profiles', 'events', ...), so
  // crossing the boundary would otherwise serve one mode's cached rows to the
  // other -- e.g. a signed-in admin clicking through to the demo would see
  // their real organisation's data. Drop the cache on each crossing, but not on
  // the initial mount, where clearing would cancel the first render's queries.
  const queryClient = useQueryClient();
  const lastSandboxState = useRef(sandboxActive);
  useEffect(() => {
    if (lastSandboxState.current === sandboxActive) {
      return;
    }
    lastSandboxState.current = sandboxActive;
    queryClient.clear();
  }, [sandboxActive, queryClient]);

  useEffect(() => {
    if (sandboxActive) {
      const syncSandboxAuth = () => {
        const current = getSandboxAuthContext();
        setSession(null);
        setUser(current.user);
        setIsAdmin(current.isAdmin);
        setIsSuperAdmin(current.isSuperAdmin);
        setOrgId(current.orgId);
        setIsLoading(false);
      };

      syncSandboxAuth();
      const unsubscribe = subscribeSandboxState(syncSandboxAuth);
      return unsubscribe;
    }

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
        
        // Check admin status after auth change
        if (session?.user) {
          setTimeout(() => {
            checkRoleStatus(session.user.id);
          }, 0);
        } else {
          setIsAdmin(false);
          setIsSuperAdmin(false);
          setOrgId(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);

      if (session?.user) {
        checkRoleStatus(session.user.id);
      }
    }).catch((error) => {
      // A rejection here (e.g. a browser that denies storage to the document)
      // must still clear the loading flag, or every guarded route is stuck on a
      // spinner forever instead of falling through to the sign-in page.
      console.error('Failed to read the existing session:', error);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [sandboxActive]);

  const checkRoleStatus = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role, org_id')
      .eq('user_id', userId);

    if (error || !data) {
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setOrgId(null);
      return;
    }

    const roleRows = (data as Array<{ role: string; org_id?: string | null }>) || [];
    const adminRole = roleRows.find((r) => r.role === 'admin');
    const superAdminRole = roleRows.find((r) => r.role === 'super_admin');

    setIsAdmin(!!adminRole);
    setIsSuperAdmin(!!superAdminRole);

    if (adminRole?.org_id) {
      setOrgId(adminRole.org_id);
      return;
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('user_id', userId)
      .maybeSingle();

    const profile = profileData as { org_id?: string | null } | null;
    setOrgId(profile?.org_id ?? null);
  };

  const signUp = async (email: string, password: string, name: string) => {
    if (sandboxActive) {
      return sandboxSignUp(email, password, name);
    }

    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { name }
      }
    });
    
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    if (sandboxActive) {
      return sandboxSignIn(email);
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { error: error as Error | null };
  };

  const signOut = async () => {
    if (sandboxActive) {
      await sandboxSignOut();
      return;
    }

    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    setIsSuperAdmin(false);
    setOrgId(null);
  };

  // In sandbox mode the persona is resolved synchronously from local state, so
  // publish it during render instead of waiting for the effect above. Otherwise
  // the first render after navigating into /sandbox still reports the live
  // (empty) session and the guarded route bounces before the effect can sync.
  const resolved = sandboxActive && sandboxContext
    ? {
        user: sandboxContext.user,
        session: null,
        isLoading: false,
        isAdmin: sandboxContext.isAdmin,
        isSuperAdmin: sandboxContext.isSuperAdmin,
        orgId: sandboxContext.orgId,
      }
    : { user, session, isLoading, isAdmin, isSuperAdmin, orgId };

  return (
    <AuthContext.Provider value={{
      ...resolved,
      signUp,
      signIn,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
