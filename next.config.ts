import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 180,
      static: 300,
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "static-jpg.lk21.party",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "pbcdnw.aoneroom.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "streamapi.web.id",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
