import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: ['@prisma/client', 'adm-zip', 'unrar', 'sharp', 'fluent-ffmpeg'],
  allowedDevOrigins: [
    /.+\.space\.z\.ai/,
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
};

export default nextConfig;
