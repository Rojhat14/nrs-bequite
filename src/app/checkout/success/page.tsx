import PaymentResult from '@/components/payment/PaymentResult'
export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false } }
export default async function PaymentStatusPage({ searchParams }: { searchParams: Promise<{ orderId?: string }> }) {
  const params = await searchParams
  return <PaymentResult orderId={typeof params.orderId === 'string' ? params.orderId : undefined} />
}
