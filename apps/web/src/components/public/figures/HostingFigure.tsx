import type { IconName } from "../../ui/Icon";
import { HOSTS } from "../../../lib/legal/config";
import { Arrow, Figure, Line, Node, Packet, Svg } from "./parts";

/* Chaîne d'hébergement de l'environnement actuel : navigateur → interface web → API → base de données.
   Les noms et les rôles viennent de HOSTS (lib/legal/config.ts) : changer d'hébergeur là-bas change aussi ce schéma.
   Aucune région ni aucune coordonnée n'est dessinée : elles restent « à compléter » dans le tableau. */

const ICONS: Record<(typeof HOSTS)[number]["id"], IconName> = { web: "link", api: "sliders", db: "folder" };

export function HostingFigure() {
  const rows = [{ id: "browser", title: "Votre navigateur", sub: "affiche le service", icon: "user" as IconName }, ...HOSTS.map((host) => ({ id: host.id, title: host.name, sub: host.role, icon: ICONS[host.id] }))];
  const gap = 100;
  return (
    <Figure
      label={`Schéma : ${rows.map((row) => (row.id === "browser" ? row.title : `${row.sub} chez ${row.title}`)).join(", puis ")}.`}
      caption="Environnement actuel. L’environnement de production pourra utiliser d’autres hébergeurs."
    >
      <Svg viewBox={`0 0 360 ${(rows.length - 1) * gap + 60}`}>
        <path data-path="flow" className="fg-track" d={`M180 60 V${(rows.length - 1) * gap}`} />
        <Packet name="flow" />
        {rows.slice(1).map((row, index) => {
          const from = index * gap + 60;
          const to = (index + 1) * gap;
          return <g key={row.id}><Line d={`M180 ${from} V${to - 7}`} /><Arrow x={180} y={to - 1} /></g>;
        })}
        {rows.map((row, index) => <Node key={row.id} x={40} y={index * gap} w={280} h={60} icon={row.icon} title={row.title} sub={row.sub} tone={row.id === "browser" ? "soft" : "plain"} />)}
      </Svg>
    </Figure>
  );
}
