"use client";

import { useId, type CSSProperties } from "react";
import { COOKIE_PATH, COOKIE_TRANSFORM, COOKIE_VIEWBOX } from "./cookiePath";

/* Le cookie fourni (cartoon-cookie-choice.svg) est un seul aplat monochrome. Pour l'animer sans modifier le tracé,
   on le dessine plusieurs fois (<use>) : un calque « corps » d'où les pépites et la coche sont découpées (masque),
   et un calque par pépite / coche, découpé à sa boîte (clipPath). Chaque calque peut alors bouger seul.
   Les boîtes sont exprimées dans le repère du viewBox ; elles ne touchent aucun autre trait du dessin. */
type Box = { x: number; y: number; w: number; h: number };

const PAD = 2.5;
const CHIPS: Box[] = [
  { x: 158.1, y: 45.1, w: 21, h: 18.8 },
  { x: 100.1, y: 55, w: 21.5, h: 23.8 },
  { x: 204.4, y: 79.1, w: 21.2, h: 21.9 },
  { x: 51, y: 84, w: 24.8, h: 21.6 },
  { x: 157.9, y: 85.3, w: 15.1, h: 14.7 },
  { x: 212.4, y: 177.1, w: 19.6, h: 18.7 },
  { x: 63.8, y: 186.1, w: 24.3, h: 23.8 },
  { x: 130, y: 203.1, w: 20.7, h: 18 },
  { x: 176.8, y: 206.1, w: 22.5, h: 23.5 },
  { x: 102, y: 224, w: 14, h: 13.5 },
];
const TICK: Box = { x: 83, y: 130, w: 36, h: 28 };
const LAYERS: Box[] = [...CHIPS, TICK];
const CRUMBS = [{ x: 96, d: 0 }, { x: 128, d: 0.9 }, { x: 160, d: 1.7 }, { x: 188, d: 2.3 }];

/* Centre d'une boîte, en pixels depuis le coin du viewBox (qui commence à x = -3) : sert d'origine aux transformations CSS. */
const origin = (box: Box) => ({ "--ox": `${box.x + box.w / 2 + 3}px`, "--oy": `${box.y + box.h / 2}px` });

const padded = (box: Box) => ({ x: box.x - PAD, y: box.y - PAD, width: box.w + PAD * 2, height: box.h + PAD * 2 });

export function CookieIllustration({ className = "" }: { className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const pathId = `ck-path-${uid}`;
  const maskId = `ck-mask-${uid}`;
  const clipId = (index: number) => `ck-clip-${uid}-${index}`;
  const draw = (
    <g transform={COOKIE_TRANSFORM}>
      <use href={`#${pathId}`} />
    </g>
  );

  return (
    <svg className={`ck ${className}`.trim()} viewBox={COOKIE_VIEWBOX} aria-hidden="true" focusable="false" fill="currentColor">
      <defs>
        <path id={pathId} d={COOKIE_PATH} />
        <mask id={maskId} maskUnits="userSpaceOnUse" x="-3" y="0" width="281" height="281">
          <rect x="-3" y="0" width="281" height="281" fill="#fff" />
          {LAYERS.map((box, index) => <rect key={index} {...padded(box)} fill="#000" />)}
        </mask>
        {LAYERS.map((box, index) => <clipPath key={index} id={clipId(index)}><rect {...padded(box)} /></clipPath>)}
      </defs>
      <g className="ck__crumbs">
        {CRUMBS.map((crumb, index) => <circle key={index} className="ck__crumb" cx={crumb.x} cy={262} r={index % 2 ? 3.2 : 4.2} style={{ "--d": `${crumb.d}s` } as CSSProperties} />)}
      </g>
      <g className="ck__body">
        <g mask={`url(#${maskId})`}>{draw}</g>
      </g>
      {CHIPS.map((box, index) => (
        <g className="ck__chip" key={index} style={{ "--i": index, ...origin(box) } as CSSProperties}>
          <g clipPath={`url(#${clipId(index)})`}>{draw}</g>
        </g>
      ))}
      <g className="ck__tick" style={origin(TICK) as CSSProperties}>
        <g clipPath={`url(#${clipId(CHIPS.length)})`}>{draw}</g>
      </g>
    </svg>
  );
}
