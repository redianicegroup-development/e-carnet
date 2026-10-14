"use client";

import { useEffect, useId, useRef } from "react";
import { ANSWER_PATH, ANSWER_VIEWBOX } from "./answerPath";
import "./welcome-character.css";

export type CharacterMood = "idle" | "greet" | "oops";

/* Le personnage « answer » (pouces levés) est un seul aplat monochrome. Pour l'animer sans toucher au tracé, on le dessine
   plusieurs fois (<use>) et chaque calque est découpé à sa zone : corps, tête (sans les yeux ni les sourcils), sourcils,
   yeux et main. Chaque calque bouge alors seul : respiration, balancement de la tête, clignement, pouce qui s'agite,
   yeux qui suivent le curseur. Les zones tombent sur des espaces vides du dessin ; la coupe du cou et du bras se fait
   là où l'on tourne autour du point de jonction, donc sans décalage visible. Couleur : currentColor (thème actif). */
type Box = { x: number; y: number; w: number; h: number };
const PAD = 0.6;
const EYE_L: Box = { x: 73, y: 65, w: 11, h: 15 };
const EYE_R: Box = { x: 101.5, y: 63.5, w: 11, h: 15 };
const BROW_L: Box = { x: 68, y: 51, w: 14, h: 10 };
const BROW_R: Box = { x: 100.5, y: 50, w: 13, h: 9 };
const padded = (box: Box) => ({ x: box.x - PAD, y: box.y - PAD, width: box.w + PAD * 2, height: box.h + PAD * 2 });
const SPARKS = [
  { dx: -46, dy: -26 }, { dx: -30, dy: -50 }, { dx: 0, dy: -58 }, { dx: 30, dy: -50 }, { dx: 46, dy: -24 }, { dx: 52, dy: 4 },
];

export function WelcomeCharacter({ mood = "idle", look = false, className = "" }: { mood?: CharacterMood; look?: boolean; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const svg = useRef<SVGSVGElement>(null);
  const id = (name: string) => `wc-${name}-${uid}`;
  const draw = <use href={`#${id("path")}`} />;

  // Les yeux et la tête suivent le curseur (écrans à souris uniquement, jamais en mouvement réduit).
  useEffect(() => {
    const node = svg.current;
    if (!look || !node) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = node.getBoundingClientRect();
        const dx = Math.max(-1, Math.min(1, (event.clientX - (box.left + box.width / 2)) / Math.max(320, window.innerWidth / 2)));
        const dy = Math.max(-1, Math.min(1, (event.clientY - (box.top + box.height * 0.38)) / Math.max(320, window.innerHeight / 2)));
        node.style.setProperty("--lx", (dx * 1.8).toFixed(2));
        node.style.setProperty("--ly", (dy * 1.3).toFixed(2));
        node.style.setProperty("--tilt", (dx * 3.2).toFixed(2));
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => { window.removeEventListener("pointermove", onMove); cancelAnimationFrame(frame); };
  }, [look]);

  return (
    <svg ref={svg} className={`wc ${className}`.trim()} data-mood={mood} viewBox={ANSWER_VIEWBOX} aria-hidden="true" focusable="false" fill="currentColor">
      <defs>
        <path id={id("path")} d={ANSWER_PATH} />
        <clipPath id={id("body")}><polygon points="0,127 56,127 56,134 134,134 134,196 0,196" /></clipPath>
        <clipPath id={id("head")}><polygon points="0,0 134,0 134,134 56,134 56,127 0,127" /></clipPath>
        <clipPath id={id("hand")}><rect x="134" y="0" width="58" height="196" /></clipPath>
        <clipPath id={id("eye-l")}><rect {...padded(EYE_L)} /></clipPath>
        <clipPath id={id("eye-r")}><rect {...padded(EYE_R)} /></clipPath>
        <clipPath id={id("brow-l")}><rect {...padded(BROW_L)} /></clipPath>
        <clipPath id={id("brow-r")}><rect {...padded(BROW_R)} /></clipPath>
        <mask id={id("head-mask")} maskUnits="userSpaceOnUse" x="0" y="0" width="192" height="196">
          <rect x="0" y="0" width="192" height="196" fill="#fff" />
          {[EYE_L, EYE_R, BROW_L, BROW_R].map((box, index) => <rect key={index} {...padded(box)} fill="#000" />)}
        </mask>
      </defs>
      <g className="wc-figure">
        <g className="wc-body"><g clipPath={`url(#${id("body")})`}>{draw}</g></g>
        <g className="wc-turn">
          <g className="wc-head">
            <g clipPath={`url(#${id("head")})`} mask={`url(#${id("head-mask")})`}>{draw}</g>
            <g className="wc-brow wc-brow--l"><g clipPath={`url(#${id("brow-l")})`}>{draw}</g></g>
            <g className="wc-brow wc-brow--r"><g clipPath={`url(#${id("brow-r")})`}>{draw}</g></g>
            <g className="wc-gaze">
              <g className="wc-eye wc-eye--l"><g clipPath={`url(#${id("eye-l")})`}>{draw}</g></g>
              <g className="wc-eye wc-eye--r"><g clipPath={`url(#${id("eye-r")})`}>{draw}</g></g>
            </g>
          </g>
        </g>
        <g className="wc-hand"><g clipPath={`url(#${id("hand")})`}>{draw}</g></g>
      </g>
      <g className="wc-sparks">
        {SPARKS.map((spark, index) => (
          <circle key={index} className="wc-spark" cx="96" cy="58" r={index % 2 ? 2.2 : 3} style={{ "--dx": `${spark.dx}px`, "--dy": `${spark.dy}px`, "--i": index } as React.CSSProperties} />
        ))}
      </g>
    </svg>
  );
}
