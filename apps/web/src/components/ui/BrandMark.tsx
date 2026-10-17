/**
 * Signe Mon E-Carnet « carnet à bouton » (dos relié + interrupteur évidé).
 * Même tracé que public/brand/logo-symbol.svg. Couleurs de marque par défaut ; surchargeables avec
 * --brand-cover / --brand-spine si le signe doit un jour suivre le thème. Décoratif : le nom est écrit à côté.
 */
export function BrandMark() {
  return (
    <span className="brand-mark brand-mark--logo" aria-hidden="true">
      <svg viewBox="14 10 72 76" focusable="false">
        <path d="M25 10.04 A12 12 0 0 0 14 22 V74 A12 12 0 0 0 25 85.96 Z" fill="var(--brand-spine, #2C3A33)" />
        <path
          fillRule="evenodd"
          fill="var(--brand-cover, #597C66)"
          d="M31 10 H74 A12 12 0 0 1 86 22 V74 A12 12 0 0 1 74 86 H31 A3 3 0 0 1 28 83 V13 A3 3 0 0 1 31 10 Z M48 37 H66 A11 11 0 0 1 66 59 H48 A11 11 0 0 1 48 37 Z"
        />
        <circle cx="66" cy="48" r="7" fill="var(--brand-cover, #597C66)" />
      </svg>
    </span>
  );
}
