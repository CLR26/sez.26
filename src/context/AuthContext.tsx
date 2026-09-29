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
      throw new Error(
        'Supabase n’est pas configuré. Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY avant de vous connecter.'
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

  const signOut = async () => {
    setError(null);
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
