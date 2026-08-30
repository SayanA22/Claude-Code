import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Server Actions handle every mutation in DayOS; keep the payload small.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
