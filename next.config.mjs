import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const editorialDirectory = fileURLToPath(new URL('./public/images/editorial/', import.meta.url));
const editorialAssets = existsSync(editorialDirectory)
  ? readdirSync(editorialDirectory, { recursive: true })
    .filter(file => /\.(jpe?g|png|webp|avif)$/i.test(file))
    .map(file => `/images/editorial/${file.replaceAll('\\', '/')}`)
  : [];

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  env: { NRS_EDITORIAL_ASSETS: JSON.stringify(editorialAssets) },
  poweredByHeader: false,
  async redirects() {
    return [
      { source: '/category/dresses', destination: '/category/elbiseler', permanent: true },
      { source: '/category/tops', destination: '/category/ust-giyim', permanent: true },
      { source: '/category/blazers', destination: '/category/ceketler-blazerlar', permanent: true },
      { source: '/category/bottoms', destination: '/category/alt-giyim', permanent: true },
      { source: '/category/suits', destination: '/category/takimlar', permanent: true },
      // Common storefront paths customers type or keep in history; none of
      // them exist as pages here.
      ...['', '/en', '/ar'].flatMap(prefix => [
        { source: `${prefix}/wishlist`, destination: `${prefix}/profile`, permanent: false },
        { source: `${prefix}/shop`, destination: `${prefix}/collections`, permanent: false },
        { source: `${prefix}/products`, destination: `${prefix}/collections`, permanent: false },
      ]),
    ];
  },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    ] }];
  },
  images: {
    // Product images are re-uploaded under the same storage path, so their
    // public URLs carry a ?v= version (see productImagePublicUrl); that lets
    // optimized copies stay cached instead of expiring after Supabase's hour.
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      ...(supabaseHostname ? [{
        protocol: 'https',
        hostname: supabaseHostname,
        port: '',
        pathname: '/storage/v1/**',
      }] : []),
    ],
  },
};

export default nextConfig;
