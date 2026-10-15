import { PulseLine } from "../motion/PulseLine";
import { PhoneMock } from "./PhoneMock";

/* « L'image » du hero : une scène illustrée de l'application (téléphone, demande d'accès, QR code temporaire).
   Elle est dessinée en HTML/CSS avec les variables du thème : nette à toutes les tailles, aucun fichier à charger, et
   elle suit la palette choisie. Tout est décoratif et fictif. Pour une vraie photo, voir HERO_IMAGE (lib/landing-content.ts). */

const QR_SIZE = 21;

/** Motif de QR code purement décoratif (non lisible) : trois repères + modules pseudo-aléatoires, identiques côté serveur et navigateur. */
function qrCells(): [number, number][] {
  const cells: [number, number][] = [];
  const inFinder = (x: number, y: number) => (x < 8 && y < 8) || (x >= QR_SIZE - 8 && y < 8) || (x < 8 && y >= QR_SIZE - 8);
  let seed = 20261014;
  const next = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  for (let y = 0; y < QR_SIZE; y += 1) for (let x = 0; x < QR_SIZE; x += 1) if (!inFinder(x, y) && next() > 0.52) cells.push([x, y]);
  return cells;
}
const FINDERS: [number, number][] = [[0, 0], [QR_SIZE - 7, 0], [0, QR_SIZE - 7]];
const CELLS = qrCells();

function QrDrawing() {
  return (
    <svg viewBox={`0 0 ${QR_SIZE} ${QR_SIZE}`} className="scene__qr-art" shapeRendering="crispEdges" focusable="false" aria-hidden="true">
      {FINDERS.map(([x, y]) => <g key={`${x}-${y}`}><rect x={x} y={y} width="7" height="7" /><rect x={x + 1} y={y + 1} width="5" height="5" className="scene__qr-gap" /><rect x={x + 2} y={y + 2} width="3" height="3" /></g>)}
      {CELLS.map(([x, y]) => <rect key={`${x}:${y}`} x={x} y={y} width="1" height="1" />)}
    </svg>
  );
}

export function HeroScene() {
  return (
    <div className="scene" aria-hidden="true">
      <span className="scene__glow scene__glow--a" />
      <span className="scene__glow scene__glow--b" />
      <span className="scene__dots" />
      <PulseLine className="scene__pulse" />
      <div className="scene__stage">
        <div className="scene__phone"><PhoneMock decorative /></div>
        <div className="scene__card scene__card--access">
          <div className="scene__card-head"><strong>Demande d’accès</strong><b className="scene__badge">À examiner</b></div>
          <p className="scene__card-who">Médecin généraliste<small>Clinique exemple</small></p>
          <dl className="scene__rows"><div><dt>Périmètre</dt><dd>Consultation</dd></div><div><dt>Durée</dt><dd>2 heures</dd></div></dl>
          <div className="scene__actions"><span>Refuser</span><span className="scene__actions-main">Autoriser</span></div>
        </div>
        <div className="scene__card scene__card--qr">
          <QrDrawing />
          <p><strong>Mon QR code</strong><small>Valable 5 minutes</small></p>
        </div>
        <div className="scene__tag"><i /> Accès autorisé · 1 h 42</div>
      </div>
    </div>
  );
}
