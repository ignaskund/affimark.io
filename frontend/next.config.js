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
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8787';
    return [
      {
        // Exclude NextAuth and local Next.js API routes from proxy.
        source: '/api/:path((?!auth/session|auth/providers|auth/signin|auth/signout|auth/callback|auth/csrf|finder/search|finder/saved|finder/session|preferences/priorities|social-accounts|storefronts).*)',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
}

module.exports = nextConfig

