import type { AgendaEntry, AgendaKind } from "../lib/agenda";
import type { IconName } from "./ui/Icon";
import { Icon } from "./ui/Icon";
import "./agenda.css";

const ICON: Record<AgendaKind, IconName> = { dose: "clock", appointment: "pin", consultation: "stethoscope" };
const TONE: Record<AgendaKind, string> = { dose: "orb--green", appointment: "", consultation: "orb--cream" };

/* Liste d'un jour : heure · pastille · titre et détail. Présentation seule, partagée par « Aujourd'hui » et l'agenda. */
export function AgendaEntries({ entries }: { entries: AgendaEntry[] }) {
  return (
    <ol className="agenda-list">
      {entries.map((entry) => (
        <li className="agenda-row" key={entry.key}>
          <time className="agenda-time">{entry.time}</time>
          <span className={`orb orb--sm ${TONE[entry.kind]}`.trim()} aria-hidden="true"><Icon name={ICON[entry.kind]} size={18} /></span>
          <span className="agenda-body"><strong>{entry.title}</strong>{entry.detail ? <span className="muted">{entry.detail}</span> : null}</span>
          {entry.badge ? <span className="badge">{entry.badge}</span> : null}
        </li>
      ))}
    </ol>
  );
}
