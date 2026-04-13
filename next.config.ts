import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "static-jpg.lk21.party",
      },
    ],
  },
};

export default nextConfig;
