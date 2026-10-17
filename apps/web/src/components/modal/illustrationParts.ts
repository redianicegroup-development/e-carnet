/* Découpe des illustrations de modal en calques (voir ModalIllustration.tsx). Données pures, sans React, donc testables.
   Coordonnées dans le viewBox de chaque dessin (tracés dans illustrationPaths.ts).
   - Une « partie » est une zone polygonale qui pivote autour de `origin`. Les coupes passent par des espaces vides ou des
     traits fins (cou, poignet) pour qu'aucune couture ne se voie ; le reste du dessin reste en place.
   - Un « œil » est la boîte d'un œil du visage : il cligne seul. `parent` = la partie qu'il accompagne quand elle bouge. */
import type { DrawnMood } from "./illustrationPaths";

export type Point = readonly [number, number];
export type Part = { name: string; poly: readonly Point[]; origin: string };
export type Eye = { x: number; y: number; w: number; h: number; parent?: string };
export type Parts = { parts: readonly Part[]; eyes: readonly Eye[] };

const rect = (x1: number, y1: number, x2: number, y2: number): Point[] => [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];

export const PARTS: Record<DrawnMood, Parts> = {
  // La femme salue de la main ; son interlocuteur (à droite, dans le second tracé) acquiesce.
  welcome: {
    parts: [
      { name: "head", poly: rect(0, 0, 157, 98), origin: "50px 98px" },
      { name: "hand", poly: rect(110, 100, 157, 181), origin: "110px 143px" },
      { name: "head-right", poly: rect(157, 0, 246, 106), origin: "200px 106px" },
    ],
    eyes: [{ x: 72, y: 56, w: 3, h: 6, parent: "head" }],
  },
  morning: {
    parts: [{ name: "head", poly: rect(0, 0, 199, 88), origin: "95px 88px" }],
    eyes: [{ x: 93, y: 50, w: 5, h: 7, parent: "head" }, { x: 111, y: 50, w: 5, h: 6, parent: "head" }],
  },
  // Yeux fermés (méditation) : rien à faire cligner.
  evening: {
    parts: [{ name: "head", poly: rect(0, 0, 185, 100), origin: "92px 100px" }],
    eyes: [],
  },
  // Le « ? » du dessin flotte à part de la tête.
  question: {
    parts: [
      { name: "head", poly: rect(0, 0, 146, 108), origin: "48px 108px" },
      { name: "mark", poly: rect(146, 26, 190, 98), origin: "168px 90px" },
    ],
    eyes: [{ x: 106, y: 64, w: 8, h: 11, parent: "head" }, { x: 76, y: 71, w: 8, h: 11, parent: "head" }],
  },
  // Personnage de dos : pas de visage. Les deux panneaux pivotent sur leur poteau.
  decision: {
    parts: [
      { name: "head", poly: rect(0, 0, 96, 104), origin: "46px 104px" },
      { name: "sign-top", poly: rect(96, 24, 195, 63), origin: "128px 46px" },
      { name: "sign-bottom", poly: rect(96, 76, 195, 114), origin: "128px 96px" },
    ],
    eyes: [],
  },
  farewell: {
    parts: [
      { name: "head-left", poly: rect(0, 0, 112, 96), origin: "62px 96px" },
      { name: "head-right", poly: rect(160, 0, 259, 104), origin: "205px 104px" },
    ],
    eyes: [
      { x: 70, y: 53, w: 4, h: 7, parent: "head-left" }, { x: 87, y: 53, w: 3, h: 6, parent: "head-left" },
      { x: 178, y: 66, w: 4, h: 5, parent: "head-right" }, { x: 193, y: 67, w: 4, h: 6, parent: "head-right" },
    ],
  },
  // Tout le dessin est la tête : c'est la figure entière qui bouge (voir illustration.css).
  listening: { parts: [], eyes: [{ x: 136, y: 103, w: 9, h: 14 }, { x: 88, y: 105, w: 9, h: 14 }] },
  oops: { parts: [], eyes: [{ x: 124, y: 105, w: 10, h: 16 }, { x: 80, y: 109, w: 10, h: 15 }] },
};
