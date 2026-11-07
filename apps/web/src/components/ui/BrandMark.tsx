import { BRAND_DUO_LOGO_SIZE, BRAND_DUO_LOGO_WEBP, PROJECT_LOGO_MINI_WEBP, PROJECT_LOGO_WEBP } from "../../lib/brand";

/**
 * Signe du projet Mon E‑Carnet (soignant + patient).
 * - `variant="duo"` : le logo complet, seul, sans tuile (en‑tête public).
 * - par défaut : le logo dans sa tuile. Sous 32 px le stéthoscope et le cœur ne se lisent plus, donc la tuile
 *   affiche la version simplifiée ; `detail` demande la version complète pour une tuile de 40 px et plus.
 */
export function BrandMark({ variant = "tile", detail = false }: { variant?: "tile" | "duo"; detail?: boolean }) {
  if (variant === "duo") {
    return (
      <span className="brand-mark brand-mark--duo" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- logo WebP local, décoratif (le lien porte déjà le nom) */}
        <img className="brand-mark__image" src={BRAND_DUO_LOGO_WEBP} alt="" width={BRAND_DUO_LOGO_SIZE.width} height={BRAND_DUO_LOGO_SIZE.height} draggable={false} />
      </span>
    );
  }
  return (
    <span className="brand-mark brand-mark--logo" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- logo WebP local, décoratif */}
      <img className="brand-mark__image" src={detail ? PROJECT_LOGO_WEBP : PROJECT_LOGO_MINI_WEBP} alt="" draggable={false} />
    </span>
  );
}
