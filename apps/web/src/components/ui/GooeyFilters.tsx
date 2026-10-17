/* Filtres SVG « gooey », définis une seule fois pour toute l'application (monté dans app/layout.tsx).
   Principe : on floute le dessin, puis on durcit son canal alpha (matrice 22x − 9) : deux formes proches se soudent en une seule matière,
   et se détachent comme une goutte quand elles s'éloignent. `atop` rend la couleur d'origine, sans voile.
   Deux réglages : « gooey » pour les panneaux (menu du compte), « gooey-soft » pour les petites gouttes (barre de navigation, boutons).
   Les filtres ne s'appliquent qu'à des calques décoratifs (aria-hidden) : le texte reste net et lisible. */
export function GooeyFilters() {
  return (
    <svg className="goo-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <filter id="ecarnet-gooey" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9" result="goo" />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
        <filter id="ecarnet-gooey-soft" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8" result="goo" />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </defs>
    </svg>
  );
}
