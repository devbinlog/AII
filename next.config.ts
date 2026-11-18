import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only badge: bottom-right keeps it off the Studio sidebar's links.
  devIndicators: { position: "bottom-right" },
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
