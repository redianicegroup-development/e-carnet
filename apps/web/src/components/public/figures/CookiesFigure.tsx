import { COOKIES } from "../../../lib/legal/config";
import { Icon } from "../../ui/Icon";
import { Figure, Svg } from "./parts";

/* Les cookies du service, rangés en deux groupes : strictement nécessaires, et mesure de fréquentation (après accord).
   Les noms viennent de COOKIES (lib/legal/config.ts) : un cookie ajouté ou retiré là-bas apparaît ici sans toucher au schéma.
   L'interrupteur se déplace une fois à l'apparition pour montrer que la mesure est un choix, puis revient à sa position d'origine. */

const WIDTH = 360;
const CHAR = 6.6; // largeur d'un caractère de la police à chasse fixe, à 11 px
const PAD = 16;

/** Range les pastilles en lignes qui ne dépassent pas la largeur du panneau. */
function layout(names: readonly string[]) {
  const chips: { name: string; x: number; row: number; w: number }[] = [];
  let x = PAD;
  let row = 0;
  for (const name of names) {
    const w = Math.round(name.length * CHAR + 22);
    if (x + w > WIDTH - PAD && x > PAD) {
      x = PAD;
      row += 1;
    }
    chips.push({ name, x, row, w });
    x += w + 8;
  }
  return { chips, rows: row + 1 };
}

export function CookiesFigure() {
  const essential = layout(COOKIES.filter((cookie) => cookie.essential).map((cookie) => cookie.name));
  const optional = layout(COOKIES.filter((cookie) => !cookie.essential).map((cookie) => cookie.name));
  const panelA = 56 + essential.rows * 32 + 6;
  const topB = panelA + 18;
  const panelB = 56 + optional.rows * 32 + 6;
  const toggleY = topB + 16;

  return (
    <Figure
      label="Schéma : les cookies strictement nécessaires d’un côté, et le cookie de mesure de fréquentation de l’autre, utilisé seulement après votre accord."
      caption="Les cookies nécessaires font fonctionner le service. La mesure de fréquentation est facultative."
    >
      <Svg viewBox={`0 0 ${WIDTH} ${topB + panelB}`}>
        <g className="fg-pop fg-tone--plain">
          <rect className="fg-node" x="0" y="0" width={WIDTH} height={panelA} rx="16" />
          <Icon name="lock" size={22} x={PAD} y={14} />
          <text><tspan className="fg-title" x={PAD + 34} y="26">Strictement nécessaires</tspan><tspan className="fg-sub" x={PAD + 34} y="42">indispensables au fonctionnement</tspan></text>
        </g>
        {essential.chips.map((chip) => (
          <g key={chip.name} className="fg-pop fg-chip">
            <rect x={chip.x} y={56 + chip.row * 32} width={chip.w} height="26" rx="13" />
            <text x={chip.x + chip.w / 2} y={56 + chip.row * 32 + 17.5} textAnchor="middle">{chip.name}</text>
          </g>
        ))}

        <g className="fg-pop fg-tone--soft">
          <rect className="fg-node" x="0" y={topB} width={WIDTH} height={panelB} rx="16" />
          <Icon name="chart" size={22} x={PAD} y={topB + 14} />
          <text><tspan className="fg-title" x={PAD + 34} y={topB + 26}>Mesure de fréquentation</tspan><tspan className="fg-sub" x={PAD + 34} y={topB + 42}>facultative, après votre accord</tspan></text>
        </g>
        <g className="fg-pop fg-toggle" aria-hidden="true">
          <rect className="fg-toggle__track" x="298" y={toggleY} width="46" height="26" rx="13" />
          <circle className="fg-toggle__knob" cx="311" cy={toggleY + 13} r="9" data-to="331" />
        </g>
        {optional.chips.map((chip) => (
          <g key={chip.name} className="fg-pop fg-chip">
            <rect x={chip.x} y={topB + 56 + chip.row * 32} width={chip.w} height="26" rx="13" />
            <text x={chip.x + chip.w / 2} y={topB + 56 + chip.row * 32 + 17.5} textAnchor="middle">{chip.name}</text>
          </g>
        ))}
      </Svg>
    </Figure>
  );
}
