import "./pictogram.css";
import { PICTOGRAM_LABELS, type PictogramName } from "../../lib/pictograms";

/* Pictogrammes en SVG intégré (aucune image à télécharger, utile en économie de données). Même trait que les icônes de l'application.
   Seul : `role="img"` + texte alternatif. À côté d'un texte qui dit déjà la même chose : `decorative` (ignoré par les lecteurs d'écran). */

const PATHS: Record<PictogramName, string> = {
  fever: "M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0ZM12 8v8",
  cough: "M4 8c3 0 3-3 6-3 4 0 4 6 0 6-3 0-3-3-6-3ZM14 13c2 0 2 2 4 2M14 17c2 0 2 2 4 2M17 9h3",
  breath: "M12 3v9M12 12c-1-2-3-3-5-3-3 0-4 4-4 8 0 2 1 3 3 3 3 0 6-3 6-8ZM12 12c1-2 3-3 5-3 3 0 4 4 4 8 0 2-1 3-3 3-3 0-6-3-6-8Z",
  head: "M7 19v-3a6 6 0 1 1 10 0v3M9 11h.01M15 11h.01M10 19h4",
  stomach: "M9 3c0 3 5 3 5 7 0 2-2 3-2 5 0 3 3 3 3 6M9 21c-3 0-5-2-5-6 0-3 2-5 5-5",
  heart: "M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11Z",
  pill: "M8.5 3.5a4.5 4.5 0 0 1 6.4 6.4l-5 5a4.5 4.5 0 0 1-6.4-6.4ZM8 8l6 6",
  syringe: "M18 3l3 3M16 5l3 3M15 6l-8 8-2 5 5-2 8-8M10 11l3 3M3 21l3-3",
  drop: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z",
  gauge: "M4 17a8 8 0 1 1 16 0M12 17l4-5M6 17h.01M18 17h.01M12 9v.01",
  scale: "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM8 9a4 4 0 0 1 8 0M12 9l2-2",
  calendar: "M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM4 10h16M8 3v4M16 3v4",
  alert: "M12 3 2 20h20L12 3ZM12 10v4M12 17h.01",
};

export function Pictogram({ name, size = 20, decorative = false }: { name: PictogramName; size?: number; decorative?: boolean }) {
  const label = PICTOGRAM_LABELS[name];
  return <svg className="pictogram" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" role={decorative ? undefined : "img"} aria-label={decorative ? undefined : label} aria-hidden={decorative ? true : undefined} focusable="false">{decorative ? null : <title>{label}</title>}<path d={PATHS[name]} /></svg>;
}
