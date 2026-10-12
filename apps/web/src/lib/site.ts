/** Origine publique à définir via NEXT_PUBLIC_SITE_URL pour chaque déploiement. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://e-carnetci.vercel.app").replace(/\/+$/, "");
