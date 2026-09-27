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

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return;
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
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [user]);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Package size={20} className="text-nrs-black/40" />
        <h2 className="text-2xl font-serif italic text-nrs-black">Order History</h2>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-nrs-black/20 border-t-nrs-black rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 px-6 bg-white/30 border border-dashed border-nrs-black/20">
          <p className="text-sm text-nrs-black/50 font-light italic">No acquisitions found in your history.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-white border border-nrs-black/10 group hover:border-nrs-black/30 transition-all duration-500"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-nrs-black/40">Order ID</p>
                  <p className="text-xs font-mono text-nrs-black">{order.id.slice(0, 8)}...</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-widest text-nrs-black/40">Date</p>
                  <p className="text-xs text-nrs-black">
                    {new Date(order.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-nrs-black/10">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    order.status === 'delivered' ? 'bg-green-500' : 'bg-amber-500'
                  }`} />
                  <span className="text-xs uppercase tracking-widest text-nrs-black/60">{order.status}</span>
                </div>
                <span className="text-sm font-serif text-nrs-black font-medium">
                  €{order.total_amount.toLocaleString()}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
