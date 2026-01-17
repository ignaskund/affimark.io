/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['lh3.googleusercontent.com', 'pbs.twimg.com', 'yt3.ggpht.com'],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        // Exclude NextAuth routes from proxy - they should be handled by Next.js
        source: '/api/:path((?!auth/session|auth/providers|auth/signin|auth/signout|auth/callback|auth/csrf).*)',
        destination: 'http://127.0.0.1:8787/api/:path*',
      },
    ];
  },
}

module.exports = nextConfig

