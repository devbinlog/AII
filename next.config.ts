import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // typedRoutes enabled after all pages are implemented
  // experimental: { typedRoutes: true },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
};

export default nextConfig;
