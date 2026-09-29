import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderId, status } = body;

    console.log('[Payment Callback] Received update for order:', orderId, 'Status:', status);

    // 1. Validate Payment Status
    if (status === 'success' || status === 'paid') {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'paid' })
        .eq('id', orderId);

      if (error) throw error;
      return NextResponse.json({ message: 'Order marked as paid' }, { status: 200 });
    }

    return NextResponse.json({ message: 'Payment failed or cancelled' }, { status: 400 });
  } catch (error: any) {
    console.error('[Payment Callback] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
