"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { FLOW_SCREENS, FLOW_STEPS, FLOW_TABS_BAR } from "./flowParts";

const STEP_MS = 6000;

/** Préférence « réduire les animations » du système, suivie en direct (faux côté serveur : le défilement ne démarre qu'une fois la page prête). */
function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const reducedMotionNow = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** « Du carnet au rendez-vous » : trois étapes, un téléphone qui montre l'écran correspondant.
 *  Le défilement automatique (6 s) s'arrête au survol, au focus, sur demande (bouton Pause) et si l'animation est réduite. */
export function FlowSection() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false); // choix de la personne : bouton Pause, ou focus clavier dans le parcours
  const [hovered, setHovered] = useState(false);
  const reduced = useSyncExternalStore(subscribeReducedMotion, reducedMotionNow, () => false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const running = !paused && !hovered && !reduced;

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => setCurrent((index) => (index + 1) % FLOW_STEPS.length), STEP_MS);
    return () => window.clearTimeout(timer);
  }, [running, current]);

  function move(index: number) {
    setCurrent(index);
    tabs.current[index]?.focus();
  }
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const count = FLOW_STEPS.length;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") { event.preventDefault(); move((index + 1) % count); }
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") { event.preventDefault(); move((index + count - 1) % count); }
  }

  return (
    <div className={`lp2-flow${running ? " lp2-auto" : ""}`} id="flow" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setPaused(true)}>
      <div>
        <div className="lp2-steps" role="tablist" aria-label="Les trois étapes">
          {FLOW_STEPS.map((step, index) => (
            <button
              key={step.title}
              ref={(element) => { tabs.current[index] = element; }}
              className="lp2-step"
              role="tab"
              id={`flow-tab-${index}`}
              aria-selected={current === index}
              aria-controls={`flow-screen-${index}`}
              tabIndex={current === index ? 0 : -1}
              type="button"
              onClick={() => setCurrent(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <span className={step.orb}>{step.icon}</span>
              <span>
                <span className="lp2-step-title">{step.title}</span>
                <span className="lp2-step-text">{step.text}</span>
              </span>
              <span className="lp2-bar"><i key={current} /></span>
            </button>
          ))}
        </div>
        {!reduced && (
          <button type="button" className="lp2-pause" aria-pressed={paused} onClick={() => setPaused((value) => !value)}>
            {paused ? "Reprendre l’animation" : "Mettre en pause l’animation"}
          </button>
        )}
      </div>
      <div className="lp2-flow-phone">
        <span className="lp2-blob" aria-hidden="true" />
        <div className="lp2-phone">
          <div className="lp2-scr">
            <span className="lp2-notch" />
            <div className="lp2-screens" aria-live={running ? "off" : "polite"}>
              {FLOW_SCREENS.map((screen, index) => (
                <div key={FLOW_STEPS[index].title} id={`flow-screen-${index}`} role="tabpanel" aria-labelledby={`flow-tab-${index}`} className={current === index ? "lp2-on" : undefined}>
                  {screen.node}
                </div>
              ))}
            </div>
            {FLOW_TABS_BAR}
          </div>
        </div>
      </div>
    </div>
  );
}
