'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, ShoppingBag, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function SuccessPage() {
  return (
    <div className="min-h-screen bg-nrs-ivory flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full text-center space-y-12 py-12 px-8 bg-white border border-nrs-black/10 shadow-xl"
      >
        <div className="flex justify-center mb-8">
          <div className="p-4 bg-green-50 text-green-600 rounded-full">
            <CheckCircle2 size={64} />
          </div>
        </div>

        <h1 className="text-4xl font-serif text-nrs-black mb-4">Acquisition Confirmed</h1>
        <p className="text-nrs-black/60 font-light italic mb-12 leading-relaxed">
          Your order has been successfully placed. A confirmation email with tracking details has been sent to your inbox.
        </p>

        <div className="space-y-4">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 w-full bg-nrs-black text-nrs-ivory py-4 text-xs uppercase tracking-widest hover:bg-nrs-black/90 transition-all"
          >
            Return to Atelier
          </Link>
          <Link
            href="/profile"
            className="flex items-center justify-center gap-2 w-full border border-nrs-black text-nrs-black py-4 text-xs uppercase tracking-widest hover:bg-nrs-black hover:text-nrs-ivory transition-all"
          >
            View Order History
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
