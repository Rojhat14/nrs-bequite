import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items, customer, totalAmount, checkoutMode } = body;

    console.log('[PayTR Create] Request received:', { items, customer });

    // 1. SERVER-SIDE PRICE VALIDATION
    // In a real scenario, we calculate the total based on PRODUCTS list to prevent price manipulation
    const finalAmount = totalAmount;

    // 2. CREATE PENDING ORDER
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          user_id: checkoutMode === 'account' ? customer.userId : null,
          customer_name: `${customer.firstName} ${customer.lastName}`,
          customer_email: customer.email,
          customer_phone: customer.phone,
          shipping_address_full: customer.address,
          shipping_city: customer.city,
          shipping_district: customer.district,
          shipping_postal_code: customer.postalCode,
          total_amount: finalAmount,
          status: 'payment_pending',
        }
      ])
      .select()
      .single();

    if (orderError) throw orderError;

    // 3. CREATE ORDER ITEMS
    const orderItems = items.map((item: any) => ({
      order_id: order.id,
      product_id: item.id,
      quantity: item.quantity,
      price_at_purchase: typeof item.price === 'number' ? item.price : parseFloat(item.price.replace(/[^0-9.-]+/g, '')),
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) throw itemsError;

    // 4. PAYTR TOKEN GENERATION (Simulation)
    // In real integration, we would use PayTR's API to create a payment token and redirect to their hosted page.
    return NextResponse.json({
      success: true,
      orderId: order.id,
      paymentUrl: `/checkout/verify?orderId=${order.id}`,
      message: 'Order created, proceeding to PayTR payment'
    }, { status: 200 });

  } catch (error: any) {
    console.error('[PayTR Create] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
