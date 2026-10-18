import { PROJECT_LOGO_WEBP } from "../../lib/brand";

/** Logo du projet et nom de marque en texte, pour rester net et lisible à toutes les tailles. */
export function BrandLogo({ height = 56, label = "Mon E‑Carnet" }: { height?: number; label?: string }) {
  return (
    <span className="brand-logo" role="img" aria-label={label} style={{ height }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- logo WebP versionné et servi depuis Cloudinary */}
      <img src={PROJECT_LOGO_WEBP} alt="" draggable={false} referrerPolicy="no-referrer" />
      <span aria-hidden="true">{label}</span>
    </span>
  );
}
