/** Logo Redianice (guide de marque). Dessiné en masque : il prend la couleur du texte autour, donc suit la palette choisie. */
export function RedianiceLogo({ width = 150, className = "" }: { width?: number; className?: string }) {
  return <span className={`rdn-logo ${className}`.trim()} role="img" aria-label="Redianice" style={{ width }} />;
}
