/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // Proxy API calls through Next.js (dev + SSR)
  // In production, client-side calls go direct via NEXT_PUBLIC_API_URL
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
