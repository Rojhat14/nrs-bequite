'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import type { ProfileRow } from '@/lib/admin/types';

interface AuthContextType {
  user: User | null;
  profile: ProfileRow | null;
  loading: boolean;
  profileLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    let active = true;
    let authEventObserved = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      authEventObserved = true;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        // Do not let an earlier session read overwrite a newer sign-in/sign-up
        // event while the initial read was in flight.
        if (active && !authEventObserved) setUser(session?.user ?? null);
      } catch {
        if (active && !authEventObserved) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    void getSession();

    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  // Run queries outside the auth callback so they cannot hold the auth lock.
  useEffect(() => {
    let active = true;
    setProfile(null);
    if (!user) { setProfileLoading(false); return; }
    setProfileLoading(true);
    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
        if (error) throw error;
        let resolved = data as ProfileRow | null;
        const firstName = user.user_metadata.first_name;
        const lastName = user.user_metadata.last_name;
        if (!resolved && typeof firstName === 'string' && typeof lastName === 'string' && firstName.trim() && lastName.trim()) {
          const { data: created, error: createError } = await supabase.from('profiles').upsert({
            id: user.id,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone: user.user_metadata.phone || null,
            email: user.email,
          }, { onConflict: 'id', ignoreDuplicates: true }).select().maybeSingle();
          if (createError) throw createError;
          resolved = created as ProfileRow | null
          // ignoreDuplicates may legitimately return no row if a profile was
          // provisioned concurrently; read it back instead of treating that
          // race as a permanently missing profile.
          if (!resolved) {
            const { data: existing, error: readError } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
            if (readError) throw readError;
            resolved = existing as ProfileRow | null
          }
        }
        if (active) setProfile(resolved)
      } catch {
        if (active) setProfile(null);
      } finally {
        if (active) setProfileLoading(false)
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
    <AuthContext.Provider value={{ user, profile, loading, profileLoading, signOut }}>
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
