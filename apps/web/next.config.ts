import path from "node:path";
import type { NextConfig } from "next";
const apiOrigin = (process.env.ECARNET_API_ORIGIN || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
const isProduction = process.env.NODE_ENV === "production";

/* ---------- SEC-01 : en-têtes de sécurité des pages web ----------
   Jusqu'ici seule l'API Django posait des en-têtes ; les pages servies par Next n'en avaient aucun.
   - En-têtes posés tout de suite : nosniff, anti-cadrage, Referrer-Policy, Permissions-Policy (caméra autorisée pour
     le scanner QR et la capture, tout le reste coupé), COOP, HSTS (production seulement : en http local il fixerait
     localhost en https).
   - CSP : d'abord en « Report-Only » (rien n'est bloqué) pour repérer les ressources tierces avant de bloquer.
     Définir ECARNET_CSP_REPORT_URI pour recevoir les rapports ; ECARNET_CSP_ENFORCE=true bascule la même politique en
     mode bloquant. Étape suivante prévue : remplacer 'unsafe-inline' par un nonce + 'strict-dynamic' (middleware). */
const hstsSeconds = Number(process.env.ECARNET_HSTS_SECONDS || 31536000);
const hstsIncludeSubdomains = process.env.ECARNET_HSTS_INCLUDE_SUBDOMAINS === "true";
const cspReportUri = (process.env.ECARNET_CSP_REPORT_URI || "").trim();
const cspEnforced = process.env.ECARNET_CSP_ENFORCE === "true";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'none'",
  ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ...(cspReportUri ? [`report-uri ${cspReportUri}`] : []),
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  ...(isProduction ? [{ key: "Strict-Transport-Security", value: `max-age=${hstsSeconds}${hstsIncludeSubdomains ? "; includeSubDomains" : ""}` }] : []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
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
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Pages seulement : les réponses JSON de l'API n'ont pas besoin de CSP. Toujours bloquant : anti-cadrage et <base>.
      { source: "/((?!api/).*)", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'" }] },
      ...(isProduction
        ? [{ source: "/((?!api/).*)", headers: [{ key: cspEnforced ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only", value: contentSecurityPolicy }] }]
        : []),
    ];
  },
};
export default nextConfig;
