import "./motion.css";

/* Ligne de rythme cardiaque décorative : le « fil de santé » de Mon E-Carnet.
   Trois tracés superposés : le rail discret, le tracé dessiné au chargement/défilement, et l'étincelle qui court dessus.
   Aucune donnée réelle : c'est une illustration (aria-hidden). Couleur = currentColor, donc elle suit la palette choisie. */

/** Un battement : onde P, complexe QRS, onde T. `scale` varie l'amplitude pour un rythme naturel. */
function beat(x: number, scale: number) {
  const r = Math.round(78 * scale);
  return `H${x + 60} q10 -14 20 0 h14 l6 10 l12 -${r} l14 ${r + 18} l8 -28 h16 q24 -34 48 0`;
}

const AMPLITUDES = [1, 0.86, 1.12, 0.94];
const PATH = `M0 100 ${AMPLITUDES.map((scale, index) => beat(index * 300, scale)).join(" ")} H1200`;

export function PulseLine({ className = "" }: { className?: string }) {
  return (
    <svg className={`pulse ${className}`.trim()} viewBox="0 0 1200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <path className="pulse__track" d={PATH} pathLength={1} />
      <path className="pulse__trace" d={PATH} pathLength={1} />
      <path className="pulse__spark" d={PATH} pathLength={1} />
    </svg>
  );
}
