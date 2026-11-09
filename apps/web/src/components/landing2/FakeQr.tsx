import type { CSSProperties, ReactElement } from "react";

/** Générateur déterministe : le même `seed` donne toujours le même motif (rendu serveur et navigateur identiques). */
function rng(seed: number) {
  let state = seed * 9301 + 49297;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

const SIZE = 25;
const INK = "#1E3A34";

function finder(x: number, y: number): ReactElement[] {
  return [
    <rect key={`f1-${x}-${y}`} x={x} y={y} width={7} height={7} fill={INK} />,
    <rect key={`f2-${x}-${y}`} x={x + 1} y={y + 1} width={5} height={5} fill="#fff" />,
    <rect key={`f3-${x}-${y}`} x={x + 2} y={y + 2} width={3} height={3} fill={INK} />,
  ];
}

/** Faux QR code illustratif : un motif au hasard, il ne contient aucune donnée et ne se scanne pas. */
export function FakeQr({ seed, style }: { seed: number; style?: CSSProperties }) {
  const random = rng(seed || 1);
  const cells: ReactElement[] = [];
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const inFinder = (x < 8 && y < 8) || (x > SIZE - 9 && y < 8) || (x < 8 && y > SIZE - 9);
      if (!inFinder && random() > 0.52) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={INK} />);
    }
  }
  return (
    <span className="lp2-qr" style={style}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} shapeRendering="crispEdges" role="presentation">
        {cells}
        {finder(0, 0)}
        {finder(SIZE - 7, 0)}
        {finder(0, SIZE - 7)}
      </svg>
    </span>
  );
}
