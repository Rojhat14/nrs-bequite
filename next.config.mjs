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
