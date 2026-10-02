'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import type { ProfileRow } from '@/lib/admin/types';

interface AuthContextType {
  user: User | null;
  profile: ProfileRow | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (active) setUser(session?.user ?? null);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    getSession();

    // 2. Listen for auth changes (sign in, sign out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  // Run queries outside the auth callback so they cannot hold the auth lock.
  useEffect(() => {
    let active = true;
    setProfile(null);
    if (!user) return;
    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
        if (error) throw error;
        if (data) {
          if (active) setProfile(data);
        } else if (user.user_metadata.first_name && user.user_metadata.last_name) {
          const { data: created, error: createError } = await supabase.from('profiles').upsert({
            id: user.id,
            first_name: user.user_metadata.first_name,
            last_name: user.user_metadata.last_name,
            phone: user.user_metadata.phone || null,
            email: user.email,
          }, { onConflict: 'id', ignoreDuplicates: true }).select().maybeSingle();
          if (createError) throw createError;
          if (active) setProfile(created);
        }
      } catch {
        if (active) setProfile(null);
      }
    };
    void fetchProfile();
    return () => { active = false; };
  }, [user]);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
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
