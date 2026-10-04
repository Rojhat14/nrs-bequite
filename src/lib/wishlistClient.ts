'use client'

import { supabase } from '@/lib/supabase'
import { createWishlistLookup } from '@/lib/wishlistLookup'

export const lookupWishlist = createWishlistLookup(async (userId, productIds) => {
  const { data, error } = await supabase.from('wishlist')
    .select('product_id').eq('user_id', userId).in('product_id', productIds)
  if (error) throw error
  return (data ?? []).map(row => row.product_id as string)
})
