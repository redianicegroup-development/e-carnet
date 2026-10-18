import type { ReactNode } from "react";

/* Étapes d'un parcours, en liste ordonnée : texte réel (sélectionnable, lu par les lecteurs d'écran) + pictogramme SVG qui se dessine.
   Un rail relie les étapes ; il se remplit au fil du défilement et chaque étape s'allume quand on l'atteint (voir InfoPageMotion).
   Sans JavaScript ou avec mouvement réduit : toutes les étapes sont affichées, rail plein. */

export type StepIcon = "qr" | "request" | "decide" | "clock" | "code" | "record" | "gate" | "consent";

/* Tracés 40 × 40, au trait. `pathLength={1}` : l'animation les dessine quelle que soit leur longueur. */
const ICONS: Record<StepIcon, string[]> = {
  qr: ["M7 7 H17 V17 H7 Z", "M23 7 H33 V17 H23 Z", "M7 23 H17 V33 H7 Z", "M23 23 H27 M31 23 H33 M23 29 H27 M31 29 V33 M23 33 H27"],
  request: ["M6 11 H34 V30 H6 Z", "M6 11 L20 22 L34 11"],
  decide: ["M20 6 A14 14 0 1 0 20 34 A14 14 0 1 0 20 6 Z", "M13 20.5 L18 25.5 L27 15"],
  clock: ["M20 6 A14 14 0 1 0 20 34 A14 14 0 1 0 20 6 Z", "M20 12 V21 L26 25"],
  code: ["M13 26 A7.5 7.5 0 1 1 18 21 L34 21", "M28 21 V27", "M33 21 V25"],
  record: ["M11 6 H25 L31 12 V34 H11 Z", "M25 6 V12 H31", "M16 20 H26 M16 26 H26"],
  gate: ["M12 18 V14 A8 8 0 0 1 28 14 V18", "M9 18 H31 V34 H9 Z", "M20 24 V29"],
  consent: ["M20 7 A6.5 6.5 0 1 0 20 20 A6.5 6.5 0 1 0 20 7 Z", "M8 34 C8 27 13 23 20 23 C27 23 32 27 32 34"],
};

export type StepDef = { icon: StepIcon; title: string; text: ReactNode };

/** `title` : intitulé visible du bloc. Le bloc répète un texte déjà écrit dans la page (liste ou paragraphe) : il est donc ignoré des lecteurs d'écran, qui n'entendent pas deux fois la même chose. */
export function Steps({ steps, title }: { steps: StepDef[]; title: string }) {
  return (
    <div className="fig-steps" aria-hidden="true">
      <p className="fig-trail__title">{title}</p>
      <ol className="trail" data-trail>
        {steps.map((step) => (
          <li className="trail__item" key={step.title}>
            <span className="trail__badge">
              <svg className="trail__icon" viewBox="0 0 40 40" focusable="false">
                {ICONS[step.icon].map((d) => <path key={d} className="fg-draw" d={d} pathLength={1} />)}
              </svg>
            </span>
            <div className="trail__body">
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
