import HomePageContent from '@/components/HomePageContent'
import { getStorefrontProducts } from '@/lib/products'

export default async function Page() {
  const products = await getStorefrontProducts()
  return <HomePageContent products={products} />
}
