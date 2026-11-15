"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { getAnalyticsConsent, subscribeAnalyticsConsent } from "../../lib/analytics-consent";
import { howToSteps, HOWTO_RESTART_EVENT, recordHowToRun, shouldAutoStartHowTo, type HowToStep } from "../../lib/howto";
import { hasSeenTour, TOUR_FINISHED_EVENT, type Rect, type TourSpace } from "../../lib/tour";
import { deviceStorage } from "../../lib/themeStorage";
import { findTarget, TourCard } from "./ProductTour";
import "./tour.css";

/* « Comment ça marche ? » : le parcours de l'espace, étape par étape, d'une page à l'autre (patient : préparer, partager le QR, retrouver ;
   médecin : se rattacher, signature, scanner, consulter ; établissement : code, validation, dossiers ; laboratoire : scanner, déposer).
   - il se lance tout seul pour les deux premières utilisations de l'espace (lib/howto.ts), une fois la visite guidée vue et les cookies choisis ;
   - « Comment ça marche ? » (menu du compte) le rouvre à tout moment, sans consommer d'utilisation ;
   - chaque étape ouvre la page où se passe l'action et met en lumière le vrai bouton ; à la fin, on revient là où on était.
   Même matière et même carte que la visite guidée (tour.css, TourCard). Rien n'est modifié pendant le guide : l'écran transparent empêche de cliquer. */

const FIRST_DELAY_MS = 5000; // laisse passer le message de bienvenue (4,2 s)
const AFTER_TOUR_DELAY_MS = 700; // laisse la visite guidée se refermer
const RESTART_DELAY_MS = 380; // laisse le menu du compte se refermer
const TARGET_POLL_MS = 100;
const TARGET_TRIES = 30; // 3 s pour que la page ouverte affiche son repère
const SETTLE_MS = 250; // laisse la page ouverte finir de s'afficher
const NAVIGATION_TIMEOUT_MS = 4000; // page demandée jamais atteinte (redirection) : la carte s'affiche au centre

export function HowToTour({ space, accountId, clinical }: { space: TourSpace; accountId: string; clinical: boolean | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [steps, setSteps] = useState<HowToStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState<Rect | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const open = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  const startPath = useRef("");
  const leaveTimer = useRef<number | undefined>(undefined);

  const begin = useCallback(() => {
    if (open.current) return;
    const found = howToSteps(space, { clinical: clinical === true });
    if (found.length === 0) return;
    open.current = true;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    startPath.current = window.location.pathname;
    setIndex(0);
    setSpot(null);
    setLeaving(false);
    setReadyFor(null);
    setSteps(found);
  }, [space, clinical]);

  // Démarrage : les deux premières utilisations (après la visite guidée, cookies choisis), ou relance depuis le menu du compte.
  useEffect(() => {
    const storage = deviceStorage();
    let timer: number | undefined;
    const canStart = () =>
      !open.current
      && getAnalyticsConsent() !== null
      && !(space === "professional" && clinical === null) // on attend de savoir si le rattachement est actif
      && shouldAutoStartHowTo({ storage, accountId, space, tourSeen: hasSeenTour(storage, accountId, space), now: Date.now() });
    const schedule = (delay: number) => {
      if (!canStart()) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!canStart()) return;
        recordHowToRun(storage, accountId, space, Date.now()); // compté au lancement : fermer ou recharger en cours de route ne le rejoue pas
        begin();
      }, delay);
    };
    const onRestart = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(begin, RESTART_DELAY_MS);
    };
    const onTourFinished = () => schedule(AFTER_TOUR_DELAY_MS);
    const onConsent = () => schedule(FIRST_DELAY_MS);
    schedule(FIRST_DELAY_MS);
    const stopConsent = subscribeAnalyticsConsent(onConsent);
    window.addEventListener(HOWTO_RESTART_EVENT, onRestart);
    window.addEventListener(TOUR_FINISHED_EVENT, onTourFinished);
    return () => {
      window.clearTimeout(timer);
      stopConsent();
      window.removeEventListener(HOWTO_RESTART_EVENT, onRestart);
      window.removeEventListener(TOUR_FINISHED_EVENT, onTourFinished);
    };
  }, [space, accountId, clinical, begin]);

  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  const finish = useCallback(() => {
    setLeaving(true);
    const back = startPath.current;
    if (back && window.location.pathname !== back) router.push(back); // on revient là où l'on était
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => {
      open.current = false;
      setSteps(null);
      setLeaving(false);
      if (opener.current?.isConnected) opener.current.focus();
    }, 220);
  }, [router]);

  const total = steps?.length ?? 0;
  const step = steps ? steps[index] : undefined;
  const next = useCallback(() => { if (index >= total - 1) finish(); else setIndex(index + 1); }, [index, total, finish]);
  const previous = useCallback(() => setIndex((value) => Math.max(0, value - 1)), []);

  // Chaque étape ouvre sa page, puis attend que le repère s'affiche avant de poser la carte.
  useEffect(() => {
    if (!step || leaving) return;
    let timer: number | undefined;
    const done = () => setReadyFor(step.id);
    if (step.href && step.href !== pathname) {
      router.push(step.href);
      timer = window.setTimeout(done, NAVIGATION_TIMEOUT_MS);
    } else {
      let tries = 0;
      const check = () => {
        if (!step.target || findTarget(step.target) || tries >= TARGET_TRIES) timer = window.setTimeout(done, step.href ? SETTLE_MS : 0);
        else { tries += 1; timer = window.setTimeout(check, TARGET_POLL_MS); }
      };
      check();
    }
    return () => window.clearTimeout(timer);
  }, [step, pathname, router, leaving]);

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

  if (!steps || !step) return null;
  const ready = readyFor === step.id;
  const shownSpot = ready ? spot : null; // pendant l'ouverture d'une page, l'ancien repère ne reste pas affiché
  const spotStyle = (shownSpot
    ? { "--spot-x": `${shownSpot.left}px`, "--spot-y": `${shownSpot.top}px`, "--spot-w": `${shownSpot.width}px`, "--spot-h": `${shownSpot.height}px` }
    : { "--spot-x": "50%", "--spot-y": "50%", "--spot-w": "0px", "--spot-h": "0px" }) as CSSProperties;

  return (
    <div className="tour" data-howto="" data-leaving={leaving || undefined}>
      <div className="tour__shield" aria-hidden="true" />
      <div className="tour__spot" data-empty={shownSpot ? undefined : true} style={spotStyle} aria-hidden="true" />
      <div className="tour__stage">
        {ready && <TourCard key={step.id} step={step} index={index} total={total} onTarget={setSpot} onNext={next} onPrevious={previous} onSkip={finish} />}
      </div>
    </div>
  );
}
