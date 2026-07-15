import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

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
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
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
    });

    return () => subscription.unsubscribe();
  }, []);

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
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    setIsSuperAdmin(false);
    setOrgId(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      isLoading, 
      isAdmin,
      isSuperAdmin,
      orgId,
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
