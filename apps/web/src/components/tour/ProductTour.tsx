"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { getAnalyticsConsent, subscribeAnalyticsConsent } from "../../lib/analytics-consent";
import {
  availableSteps, hasSeenTour, markTourSeen, padRect, placeCard, resetTour, tourSteps, TOUR_RESTART_EVENT,
  type Placement, type Rect, type TourSpace, type TourStep,
} from "../../lib/tour";
import { deviceStorage } from "../../lib/themeStorage";
import { GooLayer } from "../ui/GooLayer";
import { Icon } from "../ui/Icon";
import "./tour.css";

/* Visite guidée d'un espace (patient, professionnel, établissement) :
   - elle démarre toute seule à la première connexion, une fois le choix des cookies fait (la bannière passe avant) ;
   - elle est mémorisée par compte et par espace dans le navigateur : effacer les données du site la fait reprendre ;
   - « Revoir la visite guidée » (menu du compte) la relance à tout moment ;
   - une étape = un onglet ou un bouton réel, mis en lumière, avec ce qu'il permet de faire.
   Rien n'est modifié pendant la visite : un écran transparent empêche de cliquer à travers par erreur. */

const FIRST_DELAY_MS = 4800; // laisse passer le message de bienvenue (4,2 s) avant de commencer
const RESTART_DELAY_MS = 380; // laisse le menu du compte se refermer
const SPOT_PAD = 6;

function findTarget(name: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`);
  for (const node of Array.from(nodes)) {
    const box = node.getBoundingClientRect();
    if (box.width > 0 && box.height > 0) return node;
  }
  return null;
}

function toRect(box: DOMRect): Rect {
  return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
}

export function ProductTour({ space, accountId }: { space: TourSpace; accountId: string }) {
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState<Rect | null>(null);
  const [leaving, setLeaving] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const leaveTimer = useRef<number | undefined>(undefined);

  // Démarrage : première connexion (cookies choisis), ou relance depuis le menu du compte.
  useEffect(() => {
    const storage = deviceStorage();
    let timer: number | undefined;
    const begin = () => {
      const found = availableSteps(tourSteps(space), (target) => findTarget(target) !== null);
      if (found.length === 0) return;
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setIndex(0);
      setSpot(null);
      setLeaving(false);
      setSteps(found);
    };
    const evaluate = () => {
      if (hasSeenTour(storage, accountId, space)) return;
      if (getAnalyticsConsent() === null) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(begin, FIRST_DELAY_MS);
    };
    const onRestart = () => {
      resetTour(storage, accountId, space);
      window.clearTimeout(timer);
      timer = window.setTimeout(begin, RESTART_DELAY_MS);
    };
    evaluate();
    const stopConsent = subscribeAnalyticsConsent(evaluate);
    window.addEventListener(TOUR_RESTART_EVENT, onRestart);
    return () => {
      window.clearTimeout(timer);
      stopConsent();
      window.removeEventListener(TOUR_RESTART_EVENT, onRestart);
    };
  }, [space, accountId]);

  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  const finish = useCallback(() => {
    markTourSeen(deviceStorage(), accountId, space);
    setLeaving(true);
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => {
      setSteps(null);
      setLeaving(false);
      if (opener.current?.isConnected) opener.current.focus();
    }, 220);
  }, [accountId, space]);

  const total = steps?.length ?? 0;
  const next = useCallback(() => { if (index >= total - 1) finish(); else setIndex(index + 1); }, [index, total, finish]);
  const previous = useCallback(() => setIndex((value) => Math.max(0, value - 1)), []);

  // Clavier : Échap quitte, flèches naviguent.
  useEffect(() => {
    if (!steps || leaving) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); finish(); }
      else if (event.key === "ArrowRight") { event.preventDefault(); next(); }
      else if (event.key === "ArrowLeft") { event.preventDefault(); previous(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [steps, leaving, finish, next, previous]);

  if (!steps) return null;
  const step = steps[index];
  const spotStyle = (spot
    ? { "--spot-x": `${spot.left}px`, "--spot-y": `${spot.top}px`, "--spot-w": `${spot.width}px`, "--spot-h": `${spot.height}px` }
    : { "--spot-x": "50%", "--spot-y": "50%", "--spot-w": "0px", "--spot-h": "0px" }) as CSSProperties;

  return (
    <div className="tour" data-leaving={leaving || undefined}>
      <div className="tour__shield" aria-hidden="true" />
      <div className="tour__spot" data-empty={spot ? undefined : true} style={spotStyle} aria-hidden="true" />
      <div className="tour__stage">
        <TourCard key={step.id} step={step} index={index} total={total} onTarget={setSpot} onNext={next} onPrevious={previous} onSkip={finish} />
      </div>
    </div>
  );
}

type CardProps = {
  step: TourStep; index: number; total: number;
  onTarget: (rect: Rect | null) => void; onNext: () => void; onPrevious: () => void; onSkip: () => void;
};

function TourCard({ step, index, total, onTarget, onNext, onPrevious, onSkip }: CardProps) {
  const card = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const [place, setPlace] = useState<Placement | null>(null);
  const titleId = useId();
  const textId = useId();
  const last = index === total - 1;

  // Placement : le repère est mis en lumière, la carte se pose à côté sans le recouvrir. Tout se mesure au rendu suivant (jamais pendant l'effet).
  useEffect(() => {
    const layout = () => {
      const node = card.current;
      if (!node) return;
      const element = step.target ? findTarget(step.target) : null;
      const target = element ? padRect(toRect(element.getBoundingClientRect()), SPOT_PAD) : null;
      const box = node.getBoundingClientRect();
      setPlace(placeCard({ target, card: { width: box.width, height: box.height }, viewport: { width: window.innerWidth, height: window.innerHeight } }));
      onTarget(target);
    };
    const first = window.requestAnimationFrame(() => {
      if (step.target) findTarget(step.target)?.scrollIntoView({ block: "nearest", inline: "nearest" });
      layout();
      primary.current?.focus({ preventScroll: true });
    });
    const settle = window.setTimeout(layout, 350);
    window.addEventListener("resize", layout);
    window.addEventListener("scroll", layout, true);
    return () => {
      window.cancelAnimationFrame(first);
      window.clearTimeout(settle);
      window.removeEventListener("resize", layout);
      window.removeEventListener("scroll", layout, true);
    };
  }, [step.target, onTarget]);

  // Piège à focus : Tab reste dans la carte tant que la visite est ouverte.
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled])"));
    if (items.length === 0) return;
    const first = items[0];
    const final = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); final.focus(); }
    else if (!event.shiftKey && document.activeElement === final) { event.preventDefault(); first.focus(); }
  }

  const style: CSSProperties = place ? { left: place.left, top: place.top } : { left: 0, top: 0 };
  const item = (k: number) => ({ "--k": k } as CSSProperties);

  return (
    <>
      <div
        ref={card}
        className="tour__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
        data-ready={place ? "true" : undefined}
        data-side={place?.side}
        style={style}
        onKeyDown={onKeyDown}
      >
        <div className="tour__head" style={item(0)}>
          <span className="tour__badge" aria-hidden="true"><Icon name={step.icon} size={22} /></span>
          <span className="tour__tag">{step.tag}</span>
          <button type="button" className="tour__close" onClick={onSkip} aria-label="Quitter la visite guidée"><Icon name="close" size={16} /></button>
        </div>
        <h2 id={titleId} className="tour__title" style={item(1)}>{step.title}</h2>
        <p id={textId} className="tour__text" style={item(2)}>{step.text}</p>
        <div className="tour__progress" style={item(3)} aria-hidden="true"><span style={{ width: `${Math.round(((index + 1) / total) * 100)}%` }} /></div>
        <p className="tour__count" style={item(3)} role="status" aria-live="polite">Étape {index + 1} sur {total}</p>
        <div className="tour__actions" style={item(4)}>
          {last ? <span /> : <button type="button" className="button ghost small tour__skip" onClick={onSkip}>Passer la visite</button>}
          <span className="tour__nav">
            {index > 0 && <button type="button" className="button small" onClick={onPrevious} aria-label="Étape précédente"><Icon name="back" size={16} /></button>}
            <button ref={primary} type="button" className="button primary small" onClick={onNext}>{last ? "Terminer" : "Suivant"}{!last && <Icon name="chevron" size={16} />}</button>
          </span>
        </div>
      </div>
      {place && <GooLayer target={card} />}
    </>
  );
}
