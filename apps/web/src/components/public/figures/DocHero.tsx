import { Icon, type IconName } from "../../ui/Icon";

/* Illustration d'en-tête des pages légales : une feuille dont les lignes s'écrivent, et un badge propre au document
   (bâtiment = mentions légales, cadenas = confidentialité, personnes = conditions d'utilisation, stéthoscope = rattachement).
   Sobre et décorative : elle ne promet rien (aucune coche de conformité, aucun bouclier). */

export function DocHero({ icon }: { icon: IconName }) {
  return (
    <div className="legal__art" aria-hidden="true" data-figure>
      <svg className="fig__svg" viewBox="0 0 220 190" focusable="false">
        <g className="fg-pop"><rect className="fg-sheet fg-sheet--back" x="64" y="20" width="118" height="150" rx="14" transform="rotate(6 123 95)" /></g>
        <g className="fg-pop">
          <rect className="fg-sheet" x="38" y="10" width="124" height="156" rx="14" />
        </g>
        <path className="fg-doc-title fg-draw" d="M58 38 H112" pathLength={1} />
        <path className="fg-doc-line fg-draw" d="M58 62 H144" pathLength={1} />
        <path className="fg-doc-line fg-draw" d="M58 78 H130" pathLength={1} />
        <path className="fg-doc-line fg-draw" d="M58 94 H140" pathLength={1} />
        <path className="fg-doc-line fg-draw" d="M58 110 H112" pathLength={1} />
        <g className="fg-pop fg-tone--accent">
          <g className="fg-float">
            <circle className="fg-badge" cx="158" cy="138" r="30" />
            <Icon name={icon} size={28} x={144} y={124} />
          </g>
        </g>
      </svg>
    </div>
  );
}
