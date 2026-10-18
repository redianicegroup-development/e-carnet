import { Figure, Svg } from "./parts";

/* Le constat de la page À propos : des carnets papier successifs (dont un perdu) coupent l'historique ; Mon E‑Carnet le garde d'un seul tenant.
   Remplace l'ancien schéma en CSS : même message, en SVG animé (les carnets apparaissent, le carnet perdu s'efface, le fil de santé se dessine). */

const BOOKS = [
  { x: 0, label: "Carnet 1", lost: false },
  { x: 132, label: "Carnet 2 perdu", lost: true },
  { x: 264, label: "Carnet 3", lost: false },
];

/** Deux battements : le même motif que la ligne de pouls de la page d'accueil, à l'échelle de la barre. */
const PULSE = "M26 196 H78 l7 -9 l7 9 h10 l7 6 l9 -22 l9 32 l7 -16 h22 H196 l7 -9 l7 9 h10 l7 6 l9 -22 l9 32 l7 -16 h22 H334";

export function AboutChainFigure() {
  return (
    <Figure
      className="fig--card"
      label="Schéma : trois carnets papier successifs, le deuxième perdu, avec des coupures entre eux, face à une seule ligne d’historique continue dans Mon E‑Carnet."
    >
      <Svg viewBox="0 0 360 262">
        <text className="fg-label fg-fade" x="0" y="14">Carnets papier</text>
        {BOOKS.map((book) => (
          <g key={book.label} className={book.lost ? "fg-pop fg-book fg-book--lost" : "fg-pop fg-book"}>
            <g className={book.lost ? "fg-lost" : undefined}>
              <rect className="fg-node" x={book.x} y="26" width="96" height="84" rx="12" />
              <path className="fg-spine" d={`M${book.x + 16} 26 V110`} />
              {!book.lost && <path className="fg-ink" d={`M${book.x + 30} 54 h50 M${book.x + 30} 70 h38 M${book.x + 30} 86 h46`} />}
              {book.lost && <text className="fg-question" x={book.x + 56} y="82" textAnchor="middle">?</text>}
            </g>
            <text className="fg-sub" x={book.x + 48} y="130" textAnchor="middle">{book.label}</text>
          </g>
        ))}
        {[114, 246].map((x) => <path key={x} className="fg-cut fg-fade" d={`M${x} 46 l-6 12 l12 12 l-12 12 l6 12`} />)}

        <text className="fg-label fg-fade" x="0" y="166">Mon E‑Carnet</text>
        <g className="fg-pop fg-grow">
          <rect className="fg-bar" x="0" y="176" width="360" height="40" rx="20" />
        </g>
        <path className="fg-pulse-line fg-draw" d={PULSE} pathLength={1} />
        <text className="fg-title fg-fade" x="180" y="246" textAnchor="middle">Un seul historique</text>
      </Svg>
    </Figure>
  );
}
