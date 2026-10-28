import path from "node:path";
import type { NextConfig } from "next";
const apiOrigin = (process.env.ECARNET_API_ORIGIN || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@ecarnet/ui"],
  skipTrailingSlashRedirect: true,
  async redirects() {
    // Une seule page d'aide : /faq (ancienne adresse) renvoie vers /aide ; l'ancre éventuelle (#patient…) est conservée par le navigateur.
    return [{ source: "/faq", destination: "/aide", permanent: true }];
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*/` }];
  },
};
export default nextConfig;
