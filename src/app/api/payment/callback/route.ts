import { NextResponse } from 'next/server';

// Enable payments only after a real provider integration with server-side
// pricing, authenticated callbacks and atomic order creation is implemented.
export async function POST() {
  return NextResponse.json(
    { error: 'Online ödeme şu anda kullanılamıyor. Lütfen bizimle iletişime geçin.' },
    { status: 503 },
  );
}
