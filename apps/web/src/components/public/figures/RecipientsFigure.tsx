import { Icon, type IconName } from "../../ui/Icon";
import { Figure, Line, Node, Svg } from "./parts";

/* « Qui peut recevoir ces données » en un coup d'œil : chaque rôle ne voit que son périmètre. */

/* gate : « open » = accès aux dossiers de sa structure ou à son cas attribué ; « closed » = pas d'accès automatique ;
   « plain » = reçoit d'autres données (demandes et statuts ; données nécessaires à l'hébergement) : aucun cadenas, pour ne pas laisser croire que ces données sont inaccessibles. */
const ROWS: { id: string; icon: IconName; title: string; sub: string; gate: "open" | "closed" | "plain"; open: boolean }[] = [
  { id: "pro", icon: "stethoscope", title: "Professionnel autorisé", sub: "périmètre autorisé, durée limitée", gate: "open", open: true },
  { id: "admin", icon: "building", title: "Administrateur d’établissement", sub: "dossiers associés à sa structure", gate: "open", open: true },
  { id: "team", icon: "users", title: "Équipe de Mon E‑Carnet", sub: "demandes d’établissements et statuts", gate: "plain", open: false },
  { id: "tech", icon: "sliders", title: "Prestataires techniques", sub: "hébergement, base et e‑mails", gate: "plain", open: false },
];

const TOP = 112;
const STEP = 72;

export function RecipientsFigure() {
  const mids = ROWS.map((_, index) => TOP + index * STEP + 28);
  return (
    <Figure
      label="Schéma : le professionnel consulte uniquement le dossier du cas qui lui est attribué, selon le périmètre et la durée de l’autorisation patient. L’administrateur d’établissement consulte les dossiers associés à sa structure. Aucun accès automatique aux données d’un autre établissement."
      caption="Chaque rôle est limité à son périmètre; les données d’un autre établissement ne sont pas ouvertes automatiquement."
    >
      <Svg viewBox={`0 0 360 ${TOP + (ROWS.length - 1) * STEP + 56}`}>
        <Line d={`M180 56 V80 H22 V${mids[mids.length - 1]}`} />
        {ROWS.map((row, index) => <Line key={row.id} d={`M22 ${mids[index]} H46`} dashed={!row.open} />)}
        <Node x={40} y={0} w={280} h={56} icon="user" title="Votre carnet" sub="accessible depuis votre compte" tone="accent" />
        {ROWS.map((row, index) => (
          <g key={row.id}>
            <g className={row.open ? "fg-pop fg-gate fg-gate--open" : "fg-pop fg-gate"}>
              <circle className={row.open ? "fg-junction fg-junction--open" : "fg-junction"} cx="22" cy={mids[index]} r="13" />
              {row.gate === "plain" ? <circle className="fg-junction-dot" cx="22" cy={mids[index]} r="3.5" /> : <Icon name={row.gate === "open" ? "check" : "lock"} size={15} x={14.5} y={mids[index] - 7.5} />}
            </g>
            <Node x={46} y={TOP + index * STEP} w={314} h={56} icon={row.icon} title={row.title} sub={row.sub} tone={row.open ? "soft" : "plain"} />
          </g>
        ))}
      </Svg>
    </Figure>
  );
}
