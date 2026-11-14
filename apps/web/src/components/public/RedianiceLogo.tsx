import { REDIANICE_URL } from "../../lib/credits";

/** Logo Redianice (guide de marque). Dessiné en masque : il prend la couleur du texte autour, donc suit la palette choisie. */
export function RedianiceLogo({ width = 150, className = "" }: { width?: number; className?: string }) {
  return <span className={`rdn-logo ${className}`.trim()} role="img" aria-label="Redianice" style={{ width }} />;
}

/** Logo Redianice cliquable : ouvre le site de Redianice dans un nouvel onglet. */
export function RedianiceLogoLink({ width = 150, className = "" }: { width?: number; className?: string }) {
  return (
    <a className="rdn-link" href={REDIANICE_URL} target="_blank" rel="noopener noreferrer" aria-label="Redianice, site web (s’ouvre dans un nouvel onglet)">
      <RedianiceLogo width={width} className={className} />
    </a>
  );
}

/** Nom « Redianice » dans un texte : lien vers le site de Redianice (nouvel onglet). */
export function RedianiceLink() {
  return <a className="rdn-link rdn-link--text" href={REDIANICE_URL} target="_blank" rel="noopener noreferrer">Redianice<span className="sr-only"> (s’ouvre dans un nouvel onglet)</span></a>;
}
