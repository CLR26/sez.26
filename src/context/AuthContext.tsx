import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Agent } from '../types/database';

interface AuthContextValue {
  user: User | null;
  agent: Agent | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  isConfigured: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInDemo?: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const areAgentsEqual = (a: Agent | null, b: Agent | null): boolean => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.id === b.id &&
    a.full_name === b.full_name &&
    a.team === b.team &&
    a.active === b.active
  );
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const currentUserIdRef = useRef<string | null>(null);
  const agentRef = useRef<Agent | null>(null);

  const fetchAgentProfile = async (userId: string) => {
    try {
      const { data, error: agentError } = await supabase
        .from('agents')
        .select('*')
        .eq('id', userId)
        .single();

      if (agentError) {
        throw agentError;
      }

      if (!data?.active) {
        throw new Error('Compte inactif. Contactez un administrateur.');
      }

      const newAgent = data as Agent;
      if (!areAgentsEqual(agentRef.current, newAgent)) {
        agentRef.current = newAgent;
        setAgent(newAgent);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur de profil agent';
      setError(message);
      if (agentRef.current !== null) {
        agentRef.current = null;
        setAgent(null);
      }
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Check if there is a demo agent in session storage
      const savedDemo = sessionStorage.getItem('demo_agent');
      if (savedDemo) {
        try {
          const parsed = JSON.parse(savedDemo) as Agent;
          agentRef.current = parsed;
          currentUserIdRef.current = parsed.id;
          setAgent(parsed);
          setUser({ id: parsed.id, email: 'demo@company.com' } as unknown as User);
          setSession({ access_token: 'demo-token', user: { id: parsed.id } } as unknown as Session);
        } catch {
          // ignore
        }
      }
      setLoading(false);
      return;
    }

    // Initial session check
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        currentUserIdRef.current = currentSession.user.id;
        fetchAgentProfile(currentSession.user.id).finally(() => setLoading(false));
      } else {
        currentUserIdRef.current = null;
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      // 1. Handle SIGNED_OUT or missing session
      if (event === 'SIGNED_OUT' || !newSession?.user) {
        currentUserIdRef.current = null;
        setSession(null);
        setUser(null);
        if (agentRef.current !== null) {
          agentRef.current = null;
          setAgent(null);
        }
        return;
      }

      const newUserId = newSession.user.id;

      // 2. Ignore events unless user id changed (TOKEN_REFRESHED, repeated SIGNED_IN, etc.)
      if (newUserId === currentUserIdRef.current) {
        setSession(newSession);
        return;
      }

      // 3. User ID actually changed: update session & fetch profile silently (never call setLoading(true))
      currentUserIdRef.current = newUserId;
      setSession(newSession);
      setUser(newSession.user);
      await fetchAgentProfile(newUserId);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, pass: string) => {
    setError(null);

    if (!isSupabaseConfigured) {
      // If not configured, guide the user or allow instant preview demo
      if (email.toLowerCase().includes('demo') || pass === 'demo') {
        const demoAgent: Agent = {
          id: 'agent-demo-01',
          full_name: 'Agent Démo (Madagascar)',
          team: 'mada_ops',
          active: true,
        };
        sessionStorage.setItem('demo_agent', JSON.stringify(demoAgent));
        setAgent(demoAgent);
        setUser({ id: demoAgent.id, email } as unknown as User);
        setSession({ access_token: 'demo-token', user: { id: demoAgent.id } } as unknown as Session);
        return;
      }
      throw new Error(
        'Supabase non configuré : renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY ou utilisez le mode démo.'
      );
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });

    if (signInError) {
      throw signInError;
    }
  };

  const signInDemo = () => {
    const demoAgent: Agent = {
      id: 'agent-demo-01',
      full_name: 'Agent Démo (Madagascar)',
      team: 'mada_ops',
      active: true,
    };
    sessionStorage.setItem('demo_agent', JSON.stringify(demoAgent));
    setAgent(demoAgent);
    setUser({ id: demoAgent.id, email: 'demo@company.com' } as unknown as User);
    setSession({ access_token: 'demo-token', user: { id: demoAgent.id } } as unknown as Session);
  };

  const signOut = async () => {
    setError(null);
    sessionStorage.removeItem('demo_agent');
    if (isSupabaseConfigured) {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        throw signOutError;
      }
    }
    setAgent(null);
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        agent,
        session,
        loading,
        error,
        isConfigured: isSupabaseConfigured,
        signIn,
        signOut,
        signInDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
