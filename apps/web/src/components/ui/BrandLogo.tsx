/**
 * Logo horizontal E-carnet (signe + logotype « e-carnet » dessiné au trait). Même tracé que
 * public/brand/logo-horizontal.svg — fichier généré, à régénérer avec docs/brand/source/build_logo.py si le logo change.
 * Le nom est lu à voix haute via aria-label ; le tracé est décoratif.
 */
export function BrandLogo({ height = 56, label = "E-carnet" }: { height?: number; label?: string }) {
  return (
    <svg className="brand-logo" viewBox="0 0 337 76" height={height} role="img" aria-label={label} focusable="false">
      <g transform="translate(-14 -10)"><path d="M25 10.04 A12 12 0 0 0 14 22 V74 A12 12 0 0 0 25 85.96 Z" fill="var(--brand-spine, #2C3A33)"/><path d="M31 10 H74 A12 12 0 0 1 86 22 V74 A12 12 0 0 1 74 86 H31 A3 3 0 0 1 28 83 V13 A3 3 0 0 1 31 10 Z M48.0 37 H66.0 A11.0 11.0 0 0 1 66.0 59 H48.0 A11.0 11.0 0 0 1 48.0 37 Z" fill="var(--brand-cover, #597C66)" fillRule="evenodd"/><circle cx="66" cy="48" r="7" fill="var(--brand-cover, #597C66)"/></g><g transform="translate(88 9.40) scale(1.1)"><path d="M3 26 H25 A11 11 0 1 0 22.4 33.1 M34 27 H44 M72.4 18.9 A11 11 0 1 0 72.4 33.1 M106 26 A11 11 0 1 0 84 26 A11 11 0 1 0 106 26 M106 15 V37 M118 15 V37 M118 27 C118 19 122 15 130 15 M143 15 V37 M143 26 C143 19 148 15 153 15 C159 15 163 19 163 26 V37 M175 26 H197 A11 11 0 1 0 194.4 33.1 M214 6 V30 Q214 37 222 37 M207 15 H222" fill="none" stroke="var(--brand-spine, #2C3A33)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/></g>
    </svg>
  );
}
