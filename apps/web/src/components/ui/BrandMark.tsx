import { PROJECT_LOGO_WEBP } from "../../lib/brand";

/** Signe du projet Mon E‑Carnet, issu du logo stéthoscope-cadenas fourni. */
export function BrandMark() {
  return (
    <span className="brand-mark brand-mark--logo" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- logo WebP versionné et servi depuis Cloudinary */}
      <img className="brand-mark__image" src={PROJECT_LOGO_WEBP} alt="" draggable={false} referrerPolicy="no-referrer" />
    </span>
  );
}
