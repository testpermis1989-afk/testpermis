import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: ['@prisma/client', 'adm-zip', 'unrar', 'sharp', 'fluent-ffmpeg'],
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
};

export default nextConfig;
