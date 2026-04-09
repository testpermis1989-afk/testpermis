import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: '.',
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: ['@prisma/client', 'adm-zip', 'unrar', 'jimp'],
  allowedDevOrigins: [
    'preview-chat-03782b20-9da7-447d-a01b-6851e7199e59.space.z.ai',
    '.space.z.ai',
    'localhost:3000',
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  // Exclude packages from standalone file tracing to reduce build size
  outputFileTracingExcludes: {
    '*': [
      // Exclude typescript (not needed at runtime)
      'node_modules/typescript/**',
      // Exclude source maps
      'node_modules/source-map/**',
      'node_modules/source-map-support/**',
      // Exclude unnecessary project files from standalone
      'skills/**',
      'upload/**',
      'examples/**',
      '*.zip',
    ],
  },
};

export default nextConfig;
