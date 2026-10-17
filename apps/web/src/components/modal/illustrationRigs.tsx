import type { CSSProperties, ReactNode } from "react";
import type { DrawnMood } from "./illustrationPaths";

/* Décors animés des illustrations de modal : petits éléments ajoutés au dessin (étincelles, ondes, gouttes…). `behind` est
   dessiné derrière le personnage, `front` devant. Les mouvements sont dans illustration.css, réservés à
   prefers-reduced-motion: no-preference ; sans mouvement, ils restent invisibles. */
export type Extras = { behind?: ReactNode; front?: ReactNode };

const withIndex = (i: number) => ({ "--i": i }) as CSSProperties;

/** Petits points de lumière qui scintillent autour d'un geste. */
const sparks = (points: readonly (readonly [number, number])[]) => (
  <g>{points.map(([x, y], i) => <circle key={i} className="mi-fx" cx={x} cy={y} r={i % 2 ? 2 : 2.8} style={withIndex(i)} />)}</g>
);

const SOUND_LEFT = "M-9 118a22 22 0 0 0 0 30M-20 110a36 36 0 0 0 0 46";
const SOUND_RIGHT = "M186 112a22 22 0 0 1 0 30M197 104a36 36 0 0 1 0 46";

export const EXTRAS: Record<DrawnMood, Extras> = {
  welcome: { front: sparks([[166, 104], [150, 96]]) },
  morning: { front: sparks([[10, 84], [26, 78], [170, 80], [186, 90]]) },
  evening: { behind: <g><circle className="mi-ring" cx="92" cy="130" r="46" /><circle className="mi-ring" cx="92" cy="130" r="46" style={withIndex(1)} /></g> },
  question: {},
  decision: { front: <g><circle className="mi-fx mi-think" cx="30" cy="28" r="2.2" style={withIndex(0)} /><circle className="mi-fx mi-think" cx="22" cy="17" r="3.2" style={withIndex(1)} /><circle className="mi-fx mi-think" cx="12" cy="5" r="4.4" style={withIndex(2)} /></g> },
  farewell: { front: sparks([[104, 106], [128, 98], [152, 108]]) },
  listening: { front: <g><path className="mi-arc mi-arc--l" d={SOUND_LEFT} /><path className="mi-arc mi-arc--r" d={SOUND_RIGHT} /></g> },
  oops: { front: <path className="mi-drop" transform="translate(150 44)" d="M0-7C3.5-2 5 1 5 3.5a5 5 0 0 1-10 0C-5 1-3.5-2 0-7Z" /> },
};
