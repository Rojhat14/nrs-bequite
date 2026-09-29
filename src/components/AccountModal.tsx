'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
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
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

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

        setMessage({ type: 'success', text: 'Tekrar hoş geldiniz. Hesabınız açılıyor…' });
        setTimeout(() => {
          onClose();
          window.location.reload(); // Refresh to update navigation state
        }, 1500);

      } else {
        // --- Sign Up Logic ---
        if (!firstName || !lastName) {
          throw new Error('Lütfen adınızı ve soyadınızı girin.');
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

          setMessage({ type: 'success', text: 'Hesabınız oluşturuldu. Lütfen e-postanızı kontrol edin.' });
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
            aria-hidden="true"
            className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[121] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, scale: 0.98, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.99, y: reduceMotion ? 0 : 8 }}
              transition={{ duration: reduceMotion ? 0.1 : 0.24, ease: [0.22, 1, 0.36, 1] }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="account-modal-title"
              className="pointer-events-auto relative w-full max-w-[420px] border border-[#DCD6CA] bg-nrs-ivory p-7 shadow-[0_18px_60px_rgba(15,14,12,0.2)] sm:p-10"
            >
              <button
                type="button"
                onClick={onClose}
                aria-label="Pencereyi kapat"
                className="absolute right-5 top-5 flex size-10 items-center justify-center text-nrs-black/45 transition-colors hover:text-nrs-black focus-visible:outline focus-visible:outline-1"
              >
                <X size={20} />
              </button>

              <div className="mb-8 border-b border-nrs-black/10 pb-6 text-center">
                <p className="mb-3 text-[9px] uppercase tracking-[0.28em] text-nrs-black/45">NRS · HESABIM</p>
                <h2 id="account-modal-title" className="mb-3 font-serif text-3xl">
                  {isLogin ? 'Tekrar Hoş Geldiniz' : 'NRS Dünyasına Katılın'}
                </h2>
                <p className="text-xs leading-5 text-nrs-black/55">Kişisel seçkinize ve siparişlerinize ulaşın.</p>
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
                        <label htmlFor="account-first-name" className="text-[10px] uppercase tracking-widest text-nrs-black/50 block text-left ml-1">
                          Ad
                        </label>
                        <input
                          id="account-first-name"
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="w-full bg-transparent border-b border-nrs-black/20 py-2 px-1 focus:border-nrs-black outline-none transition-all duration-500 font-light text-sm"
                          placeholder="Adınız"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="account-last-name" className="text-[10px] uppercase tracking-widest text-nrs-black/50 block text-left ml-1">
                          Soyad
                        </label>
                        <input
                          id="account-last-name"
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className="w-full bg-transparent border-b border-nrs-black/20 py-2 px-1 focus:border-nrs-black outline-none transition-all duration-500 font-light text-sm"
                          placeholder="Soyadınız"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                        <label htmlFor="account-phone" className="text-[10px] uppercase tracking-widest text-nrs-black/50 block text-left ml-1">
                          Telefon
                        </label>
                        <input
                          id="account-phone"
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
                  <label htmlFor="account-email" className="text-[10px] uppercase tracking-widest text-nrs-black/50 block text-left ml-1">
                    E-posta
                  </label>
                  <input
                    id="account-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-transparent border-b border-nrs-black/20 py-2 px-1 focus:border-nrs-black outline-none transition-all duration-500 font-light text-sm"
                    placeholder="eposta@ornek.com"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="account-password" className="text-[10px] uppercase tracking-widest text-nrs-black/50 block text-left ml-1">
                    Şifre
                  </label>
                  <input
                    id="account-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-transparent border-b border-nrs-black/20 py-2 px-1 focus:border-nrs-black outline-none transition-all duration-500 font-light text-sm"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-4 min-h-12 w-full border border-nrs-black bg-nrs-black px-4 py-3 text-[10px] uppercase tracking-[0.22em] text-nrs-ivory transition-colors duration-300 hover:bg-nrs-black/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nrs-black disabled:bg-nrs-black/40"
                >
                  {loading ? 'İşleniyor…' : (isLogin ? 'Giriş Yap' : 'Hesap Oluştur')}
                </button>
              </form>

              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setMessage(null);
                  }}
                  className="min-h-11 px-2 text-[11px] text-nrs-black/60 underline underline-offset-4 transition-colors hover:text-nrs-black focus-visible:outline focus-visible:outline-1"
                >
                  {isLogin ? 'Hesabınız yok mu? Kayıt olun' : 'Zaten hesabınız var mı? Giriş yapın'}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
