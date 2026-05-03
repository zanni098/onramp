import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface MerchantProfile {
  id: string;
  business_name: string | null;
  solana_wallet: string | null;
  polygon_wallet: string | null;
  webhook_url: string | null;
  public_key: string | null;
  // NOTE: webhook_secret and secret_key are NOT loaded into the browser.
  // They live in merchant_secrets (service-role only) and are fetched
  // on demand via the get-merchant-secrets / rotate-* Edge Functions.
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: MerchantProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => { },
  refreshProfile: async () => { },
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    // Explicit column list — never SELECT * on a table that may grow secret
    // columns. If a future migration accidentally re-adds a sensitive field,
    // it stays out of the browser by default.
    const { data } = await supabase
      .from('profiles')
      .select(
        'id, business_name, solana_wallet, polygon_wallet, webhook_url, public_key',
      )
      .eq('id', userId)
      .single();
    setProfile((data as MerchantProfile) ?? null);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
