import type { NextConfig } from "next";
const apiOrigin = (process.env.ECARNET_API_ORIGIN || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
const nextConfig: NextConfig = {
  transpilePackages: ["@ecarnet/ui"],
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
};
export default nextConfig;
