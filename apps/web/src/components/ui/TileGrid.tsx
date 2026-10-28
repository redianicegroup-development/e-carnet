import Link from "next/link";
import { Icon, type IconName } from "./Icon";

export type TileItem = { href: string; icon: IconName; title: string; text?: string };

/* Orbes alternés : miel, vert, crème… Ce sont des dérivés de la palette du thème (tokens.css), jamais de nouvelles teintes. */
const TONES = ["", "orb--green", "orb--cream", "orb--mint", "orb--deep", "orb--green"];

/* Grille de tuiles des maquettes mobile : un orbe d'icône et un libellé court. Le texte d'aide reste dans l'étiquette accessible du lien. */
export function TileGrid({ items, label }: { items: TileItem[]; label: string }) {
  return (
    <section aria-label={label}>
      <ul className="tile-grid">
        {items.map((item, index) => (
          <li key={item.href}>
            <Link className="tile" href={item.href} aria-label={item.text ? `${item.title} : ${item.text}` : item.title}>
              <span className={`orb ${TONES[index % TONES.length]}`.trim()} aria-hidden="true"><Icon name={item.icon} /></span>
              <span>{item.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
