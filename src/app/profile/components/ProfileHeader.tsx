'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Phone, Edit2, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface ProfileHeaderProps {
  profile: any;
}

export default function ProfileHeader({ profile }: ProfileHeaderProps) {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    phone: profile?.phone || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone,
        })
        .eq('id', user?.id);

      if (error) throw error;
      setIsEditing(false);
      // In a real app, we'd update the AuthContext state here
      window.location.reload();
    } catch (err) {
      console.error('Error updating profile:', err);
      alert('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="text-center space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <h1 className="text-4xl md:text-5xl font-serif italic text-nrs-black">Your Atelier Account</h1>
        <div className="h-px w-20 bg-nrs-black/20 mx-auto" />
      </motion.div>

      <div className="max-w-lg mx-auto bg-white/50 backdrop-blur-sm p-8 border border-nrs-black/10 rounded-sm">
        {!isEditing ? (
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-2">
              <h2 className="text-2xl font-serif text-nrs-black">
                {profile?.first_name} {profile?.last_name}
              </h2>
              <p className="text-xs uppercase tracking-widest text-nrs-black/50">{profile?.email}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left max-w-md mx-auto pt-6 border-t border-nrs-black/10">
              <div className="flex items-center gap-3 text-sm text-nrs-black/70">
                <Phone size={14} className="text-nrs-black/40" />
                <span>{profile?.phone || 'No phone provided'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-nrs-black/70">
                <User size={14} className="text-nrs-black/40" />
                <span>Member since {profile?.created_at ? new Date(profile.created_at).getFullYear() : '2026'}</span>
              </div>
            </div>

            <button
              onClick={() => setIsEditing(true)}
              className="mt-6 inline-flex items-center gap-2 text-[10px] uppercase tracking-widest text-nrs-black/60 hover:text-nrs-black transition-colors group"
            >
              <Edit2 size={12} className="group-hover:scale-110 transition-transform" />
              Edit Personal Details
            </button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 gap-6 text-left max-w-md mx-auto">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest text-nrs-black/50 block">First Name</label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full bg-transparent border-b border-nrs-black/20 py-2 focus:border-nrs-black outline-none transition-all duration-500 font-light text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest text-nrs-black/50 block">Last Name</label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full bg-transparent border-b border-nrs-black/20 py-2 focus:border-nrs-black outline-none transition-all duration-500 font-light text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest text-nrs-black/50 block">Phone Number</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-transparent border-b border-nrs-black/20 py-2 focus:border-nrs-black outline-none transition-all duration-500 font-light text-sm"
                />
              </div>
            </div>

            <div className="flex justify-center gap-4 pt-4">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-[10px] uppercase tracking-widest text-nrs-black/50 hover:text-nrs-black transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-nrs-black text-nrs-ivory text-[10px] uppercase tracking-widest hover:bg-nrs-black/90 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? 'Saving...' : <><Check size={12} /> Save Changes</>}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
