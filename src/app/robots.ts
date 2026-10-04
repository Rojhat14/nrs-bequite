import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/profile', '/wishlist', '/cart', '/checkout', '/api/'],
    },
    sitemap: 'https://nrsbequiteluminous.com/sitemap.xml',
  }
}
