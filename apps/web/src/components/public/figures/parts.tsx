import type { ReactNode } from "react";
import { Icon, type IconName } from "../../ui/Icon";

/* Briques communes des schémas des pages d'information (légales, crédits, à propos).
   Règles : couleurs = variables du thème (les cinq palettes restent respectées) ; texte du schéma = texte réel de la page (jamais d'information
   qui n'est pas écrite ailleurs) ; le schéma est décoratif pour les lecteurs d'écran, qui reçoivent un résumé (`label`) et la légende.
   Les classes « fg-… » sont animées par components/motion/InfoPageMotion.tsx ; sans JavaScript ou avec mouvement réduit, l'état final est affiché. */

/** Coupe un texte en lignes d'au plus `max` caractères (les tspans SVG ne reviennent pas à la ligne tout seuls). */
export function wrapText(text: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** `label` : résumé lu à voix haute. `caption` : légende visible, lue normalement (elle n'est pas dans le rôle « img »). */
export function Figure({ label, caption, className = "", children }: { label: string; caption?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <figure className={`fig ${className}`.trim()} data-figure>
      <div className="fig__art" role="img" aria-label={label}>{children}</div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

export function Svg({ viewBox, children }: { viewBox: string; children: ReactNode }) {
  return <svg className="fig__svg" viewBox={viewBox} focusable="false" aria-hidden="true">{children}</svg>;
}

export type Tone = "plain" | "soft" | "accent" | "ghost";

/** Carte du schéma : icône facultative à gauche, titre en gras, précision en dessous. Titre et précision peuvent être des lignes déjà coupées. `pad` : début du texte à partir du bord gauche (réduit pour les cartes étroites). */
export function Node({ x, y, w, h, title, sub, tone = "plain", icon, pad = 52 }: { x: number; y: number; w: number; h: number; title: string | string[]; sub?: string | string[]; tone?: Tone; icon?: IconName; pad?: number }) {
  const titles = Array.isArray(title) ? title : [title];
  const subs = sub === undefined ? [] : Array.isArray(sub) ? sub : [sub];
  const total = titles.length * 17 + subs.length * 15;
  const top = y + (h - total) / 2 + 13;
  const left = icon ? x + pad : x + w / 2;
  return (
    <g className={`fg-pop fg-tone--${tone}`}>
      <rect className="fg-node" x={x} y={y} width={w} height={h} rx={16} />
      {icon && <Icon name={icon} size={22} x={x + 17} y={y + (h - 22) / 2} />}
      <text textAnchor={icon ? "start" : "middle"}>
        {titles.map((line, index) => <tspan key={`t${index}`} className="fg-title" x={left} y={top + index * 17}>{line}</tspan>)}
        {subs.map((line, index) => <tspan key={`s${index}`} className="fg-sub" x={left} y={top + titles.length * 17 + index * 15 - 2}>{line}</tspan>)}
      </text>
    </g>
  );
}

/** Pointe de flèche dont la pointe est exactement en (x, y). */
export function Arrow({ x, y, dir = "down" }: { x: number; y: number; dir?: "down" | "up" | "right" }) {
  const d = dir === "down" ? `M${x - 5} ${y - 7} L${x} ${y} L${x + 5} ${y - 7}` : dir === "up" ? `M${x - 5} ${y + 7} L${x} ${y} L${x + 5} ${y + 7}` : `M${x - 7} ${y - 5} L${x} ${y} L${x - 7} ${y + 5}`;
  return <path className="fg-arrow fg-pop" d={d} />;
}

/** Trait qui se dessine. `pathLength={1}` permet à l'animation de tracer n'importe quelle longueur (voir PulseLine). */
export function Line({ d, dashed = false, travel }: { d: string; dashed?: boolean; travel?: string }) {
  return dashed
    ? <path className="fg-line fg-line--dash fg-fade" d={d} />
    : <path className="fg-line fg-draw" d={d} pathLength={1} data-path={travel} />;
}

/** Point lumineux qui parcourt le tracé `data-path` du même nom, en boucle (voir InfoPageMotion). Placé AVANT les cartes pour passer dessous. */
export function Packet({ name, reverse = false }: { name: string; reverse?: boolean }) {
  return <circle className="fg-dot" r={4.5} cx={-20} cy={-20} data-travel={name} data-reverse={reverse ? "" : undefined} />;
}
