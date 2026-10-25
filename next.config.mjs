/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['better-sqlite3', 'node-ical'],
  experimental: {
    serverActions: { bodySizeLimit: '30mb' },
  },
};

export default nextConfig;
