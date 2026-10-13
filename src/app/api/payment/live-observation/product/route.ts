import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { paymentAvailableForUser } from '@/lib/payment/provider'
import { controlledLiveAccountAllowed, garantiLiveObservationOnly } from '@/lib/payment/garanti/config'
import { paymentDatabase } from '@/lib/payment/repository'
import { isLiveObservationProduct, LIVE_OBSERVATION_PRODUCT_ID } from '@/lib/payment/garanti/live-observation-product'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const unavailable = () => NextResponse.json({ error: 'Bu deneme akışı kullanılamıyor.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })

export async function GET() {
  try {
    const auth = await createSupabaseServerClient()
    const { data: { user } } = await auth.auth.getUser()
    if (!user || !controlledLiveAccountAllowed(user.id) || !paymentAvailableForUser(user.id) || !garantiLiveObservationOnly()) return unavailable()

    const db = paymentDatabase()
    const [productResult, variantResult] = await Promise.all([
      db.from('products').select('id,name,description,price_amount,currency,status,in_stock,payment_test_only').eq('id', LIVE_OBSERVATION_PRODUCT_ID).maybeSingle(),
      db.from('product_variants').select('id,product_id,size,stock_quantity,is_active').eq('product_id', LIVE_OBSERVATION_PRODUCT_ID).eq('is_active', true).order('id').limit(2),
    ])
    const product = productResult.data
    if (productResult.error || variantResult.error || !product || !isLiveObservationProduct(product)
      || variantResult.data?.length !== 1 || variantResult.data[0].product_id !== LIVE_OBSERVATION_PRODUCT_ID
      || variantResult.data[0].stock_quantity < 1) return unavailable()

    return NextResponse.json({
      product: { id: LIVE_OBSERVATION_PRODUCT_ID, title: product.name, price: '₺3', variantId: variantResult.data[0].id,
        ...(variantResult.data[0].size ? { size: variantResult.data[0].size } : {}) },
    }, { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } })
  } catch {
    return unavailable()
  }
}
