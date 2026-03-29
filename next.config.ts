import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    'preview-chat-03782b20-9da7-447d-a01b-6851e7199e59.space.z.ai',
    '.space.z.ai',
    'localhost:3000',
  ],
};

export default nextConfig;
