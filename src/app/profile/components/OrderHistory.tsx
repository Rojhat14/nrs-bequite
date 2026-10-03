'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Package, Clock, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function OrderHistory() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      setErrorMessage('');
      if (!user) { setOrders([]); setLoading(false); return; }
      try {
        const { data, error } = await supabase
          .from('orders')
          .select(`*, order_items(*)`)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setOrders(data || []);
      } catch (err) {
        console.error('Error fetching orders:', err);
        setErrorMessage('Siparişler yüklenemedi. Lütfen sayfayı yenileyerek tekrar deneyin.');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [user]);

  return (
    <div id="orders" className="space-y-8 scroll-mt-32">
      <div className="flex items-center gap-4">
        <Package size={20} className="text-nrs-ink/60" />
        <h2 className="text-2xl font-serif italic text-nrs-ink">Order History</h2>
      </div>

      {errorMessage ? <p role="alert" className="text-sm text-red-400">{errorMessage}</p> : loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-nrs-ink/20 border-t-nrs-ink rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 px-6 bg-nrs-panel/30 border border-dashed border-nrs-ink/20">
          <p className="text-sm text-nrs-ink/65 font-light italic">No acquisitions found in your history.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-nrs-panel border border-nrs-ink/10 group hover:border-nrs-ink/30 transition-all duration-500"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-nrs-ink/60">Order ID</p>
                  <p className="text-xs font-mono text-nrs-ink">{order.id.slice(0, 8)}...</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-widest text-nrs-ink/60">Date</p>
                  <p className="text-xs text-nrs-ink">
                    {new Date(order.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 justify-between items-center pt-4 border-t border-nrs-ink/10">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    order.status === 'delivered' ? 'bg-green-500' : 'bg-amber-500'
                  }`} />
                  <span className="text-xs uppercase tracking-widest text-nrs-ink/60">{order.status}</span>
                </div>
                <span className="text-sm font-serif text-nrs-ink font-medium">
                  ₺{Number(order.total_amount).toLocaleString('tr-TR')}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
