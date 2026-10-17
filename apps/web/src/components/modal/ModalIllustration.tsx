"use client";

import { useId } from "react";
import type { CSSProperties } from "react";
import { WelcomeCharacter } from "../auth/WelcomeCharacter";
import { ILLUSTRATION_PATHS, type DrawnMood } from "./illustrationPaths";
import { PARTS, type Eye, type Point } from "./illustrationParts";
import { EXTRAS } from "./illustrationRigs";
import "./modal.css";
import "./illustration.css";

/* Une « humeur » = une illustration du dossier .modal (public/illustrations/modal, dont les tracés sont recopiés dans
   illustrationPaths.ts). Pour changer l'illustration d'une situation, il suffit de changer l'humeur passée à la modal.
   Toutes sont animées comme le personnage de la page de connexion ; « success » EST ce personnage (même dessin). */
export type ModalMood = "welcome" | "morning" | "evening" | "success" | "question" | "decision" | "farewell" | "listening" | "oops";
// welcome — coaching : on vous accueille et on vous explique        morning — exercising : énergie du matin
// evening — meditating : calme du soir                               success — answer : c'est bon, merci
// question — hésitation avant une action sensible                    decision — carrefour, un choix à faire
// farewell — discharging-patient : fin d'un rattachement, sortie     listening — face-headset : on vous écoute (feedback)
// oops — face-bandage : petit souci, on réessaie

type Props = { mood: ModalMood; size?: "sm" | "md" | "lg" };

const outline = (poly: readonly Point[]) => `M${poly.map(([x, y]) => `${x} ${y}`).join("L")}Z`;
const PAD = 0.6;
const padded = (eye: Eye) => ({ x: eye.x - PAD, y: eye.y - PAD, width: eye.w + PAD * 2, height: eye.h + PAD * 2 });

/* Le dessin est un aplat monochrome colorié par `currentColor` : il suit le thème (palette claire/sombre). Chaque partie
   mobile et chaque œil sont le même tracé (<use>) découpé à sa zone ; le reste est masqué de ces zones, avec un recouvrement
   d'un demi-point pour qu'aucune couture claire n'apparaisse au repos. Les yeux sont rangés dans la partie qu'ils suivent. */
function DrawnIllustration({ mood }: { mood: DrawnMood }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (name: string) => `mi-${name}-${uid}`;
  const { viewBox, d } = ILLUSTRATION_PATHS[mood];
  const [, , width, height] = viewBox.split(" ").map(Number);
  const { parts, eyes } = PARTS[mood];
  const { behind, front } = EXTRAS[mood];
  const draw = <use href={`#${id("path")}`} />;
  const eyesOf = (parent?: string) => eyes.map((eye, index) => ({ eye, index })).filter(({ eye }) => eye.parent === parent);
  const eyeLayers = (parent?: string) => eyesOf(parent).map(({ eye, index }) => (
    <g key={index} className="mi-eye" style={{ "--o": `${eye.x + eye.w / 2}px ${eye.y + eye.h / 2}px`, "--j": index } as CSSProperties}>
      <g clipPath={`url(#${id(`eye-${index}`)})`}>{draw}</g>
    </g>
  ));
  const holes = (parent?: string) => eyesOf(parent).map(({ eye, index }) => <rect key={index} {...padded(eye)} fill="#000" />);

  return (
    <svg className="mi" data-mood={mood} viewBox={viewBox} focusable="false" fill="currentColor">
      <defs>
        <path id={id("path")} d={d} />
        <mask id={id("rest")} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height}>
          <rect x="0" y="0" width={width} height={height} fill="#fff" />
          {parts.map((part) => <path key={part.name} d={outline(part.poly)} fill="#000" stroke="#fff" strokeWidth="1" />)}
          {holes(undefined)}
        </mask>
        {parts.map((part) => (
          <g key={part.name}>
            <clipPath id={id(part.name)}><path d={outline(part.poly)} /></clipPath>
            <mask id={id(`${part.name}-mask`)} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height}>
              <rect x="0" y="0" width={width} height={height} fill="#fff" />
              {holes(part.name)}
            </mask>
          </g>
        ))}
        {eyes.map((eye, index) => <clipPath key={index} id={id(`eye-${index}`)}><rect {...padded(eye)} /></clipPath>)}
      </defs>
      {behind}
      <g className="mi-figure">
        <g className="mi-rest" mask={`url(#${id("rest")})`}>{draw}</g>
        {parts.map((part) => (
          <g key={part.name} className={`mi-part mi-${part.name}`} style={{ "--o": part.origin } as CSSProperties}>
            <g clipPath={`url(#${id(part.name)})`}><g mask={`url(#${id(`${part.name}-mask`)})`}>{draw}</g></g>
            {eyeLayers(part.name)}
          </g>
        ))}
        {eyeLayers(undefined)}
      </g>
      {front}
    </svg>
  );
}

export function ModalIllustration({ mood, size = "md" }: Props) {
  return (
    <span className={`modal-illustration modal-illustration--${size}`} data-mood={mood} aria-hidden="true">
      {mood === "success" ? <WelcomeCharacter mood="greet" /> : <DrawnIllustration mood={mood} />}
    </span>
  );
}
