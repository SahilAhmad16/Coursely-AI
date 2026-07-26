import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "yewrqvgmkoidxthpxulc.supabase.co", pathname: "/storage/v1/object/sign/product-media/**" }],
  },
};

export default nextConfig;
