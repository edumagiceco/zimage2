/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'http',
        hostname: 'minio',
        port: '9000',
      },
      {
        protocol: 'http',
        hostname: '192.168.1.81',
        port: '9020',
      },
      {
        protocol: 'http',
        hostname: '**',  // Allow any hostname for flexibility
      },
    ],
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost/api',
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'Z-Image',
  },

  // Experimental features (serverActions is now enabled by default in Next.js 14)

  // Webpack configuration
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    return config;
  },
};

module.exports = nextConfig;
