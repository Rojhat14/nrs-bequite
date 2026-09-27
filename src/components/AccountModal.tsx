'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AccountModal({ isOpen, onClose }: AccountModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isLogin) {
        // --- Login Logic ---
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        setMessage({ type: 'success', text: 'Welcome back! Redirecting...' });
        setTimeout(() => {
          onClose();
          window.location.reload(); // Refresh to update navigation state
        }, 1500);

      } else {
        // --- Sign Up Logic ---
        if (!firstName || !lastName) {
          throw new Error('Please enter your first and last name.');
        }

        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (authError) throw authError;

        if (data.user) {
          // Save additional info to public.profiles table
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([
              {
                id: data.user.id,
                first_name: firstName,
                last_name: lastName,
                phone: phone,
                email: email
              },
            ]);

          if (profileError) throw profileError;

          setMessage({ type: 'success', text: 'Account created! Please check your email.' });
        }
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'An unexpected error occurred. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="bg-nrs-ivory w-full max-w-md p-8 md:p-12 shadow-2xl pointer-events-auto relative"
            >
              <button
                onClick={onClose}
                className="absolute top-6 right-6 text-nrs-black/40 hover:text-nrs-black transition-colors"
              >
                <X size={20} />
              </button>

              <div className="text-center mb-10">
                <h2 className="text-3xl font-serif italic mb-2">
                  {isLogin ? 'Welcome Back' : 'Join the Atelier'}
                </h2>
                <div className="h-px w-12 bg-nrs-black/20 mx-auto" />
              </div>

              {message && (
                <div className={`mb-6 text-center text-[11px] uppercase tracking-widest p-3 ${
                  message.type === 'success' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
                }`}>
                  {message.text}
                </div>
              )}

              <form className="space-y-6" onSubmit={handleAuth}>
                {!isLogin && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase tracking-widest text-nrs-black/50 block text-left ml-1">
                          First Name
                        </label>
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="w-full bg-transparent border-b border-nrs-black/20 py-2 px-1 focus:border-nrs-black outline-none transition-all duration-500 font-light text-sm"
                          placeholder="First Name"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase tracking-widest text-nrs-black/50 block text-left ml-1">
                          Last Name
                        </label>
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className="w-full bg-transparent border-b border-nrs-black/20 py-2 px-1 focus:border-nrs-black outline-none transition-all duration-500 font-light text-sm"
                          placeholder="Last Name"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-widest text-nrs-black/50 block text-left ml-1">
                        Phone Number
                      </label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-transparent border-b border-nrs-black/20 py-2 px-1 focus:border-nrs-black outline-none transition-all duration-500 font-light text-sm"
                        placeholder="+90 5xx xxx xx xx"
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-nrs-black/50 block text-left ml-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-transparent border-b border-nrs-black/20 py-2 px-1 focus:border-nrs-black outline-none transition-all duration-500 font-light text-sm"
                    placeholder="email@example.com"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-nrs-black/50 block text-left ml-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-transparent border-b border-nrs-black/20 py-2 px-1 focus:border-nrs-black outline-none transition-all duration-500 font-light text-sm"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <button
                  disabled={loading}
                  className="w-full py-4 bg-nrs-black text-nrs-ivory uppercase tracking-widest text-[10px] hover:bg-nrs-black/90 transition-all duration-500 mt-4 disabled:bg-nrs-black/40"
                >
                  {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
                </button>
              </form>

              <div className="mt-8 text-center">
                <button
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setMessage(null);
                  }}
                  className="text-[11px] text-nrs-black/60 hover:text-nrs-black transition-colors underline underline-offset-4"
                >
                  {isLogin ? "Don't have an account? Register" : "Already have an account? Sign In"}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
