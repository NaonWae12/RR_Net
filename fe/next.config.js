/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker
  output: 'standalone',
  
  // Performance optimizations
  reactStrictMode: true,
  
  // Code splitting optimization
  experimental: {
    optimizePackageImports: [
      '@tanstack/react-table',
      'recharts',
      'react-hook-form',
      'zod',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      'sonner',
    ],
  },

  // Turbopack configuration (Next.js 16+)
  turbopack: {
    // Turbopack handles code splitting automatically
    // Additional configuration can be added here if needed
  },

  // Webpack configuration (fallback for --webpack flag)
  webpack: (config, { isServer }) => {
    // Optimize bundle size
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Vendor chunks
            vendor: {
              name: 'vendor',
              chunks: 'all',
              test: /node_modules/,
              priority: 20,
            },
            // Common components chunk
            commonComponents: {
              name: 'common-components',
              test: /[\\/]components[\\/](tables|charts|forms|modals|utilities|layouts|feedback)[\\/]/,
              chunks: 'all',
              priority: 30,
              reuseExistingChunk: true,
            },
            // UI primitives chunk
            uiPrimitives: {
              name: 'ui-primitives',
              test: /[\\/]components[\\/]ui[\\/]/,
              chunks: 'all',
              priority: 25,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }
    return config;
  },

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Compression
  compress: true,

  // Security headers (additional to middleware.ts)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=()',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

