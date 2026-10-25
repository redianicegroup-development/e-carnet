import type { IconName } from "../components/ui/Icon";
import type { SpaceId } from "./spaces";

/* Visite guidée de la première connexion : une par espace (patient, professionnel, établissement).
   Chaque étape désigne un repère `data-tour="…"` posé sur un onglet ou un bouton réel de l'espace ; sans repère, l'étape s'affiche au centre.
   Ce fichier ne contient ni React ni accès au DOM (hors `Storage` passé en paramètre) : il se teste seul. */

export type TourSpace = SpaceId;

export type TourStep = {
  id: string;
  /** Valeur de `data-tour` de l'élément mis en lumière. Absent : étape centrée (accueil de la visite). */
  target?: string;
  icon: IconName;
  tag: string;
  title: string;
  text: string;
  /** L'étape n'a de sens que si son repère est affiché (ex. onglets masqués tant que le rattachement n'est pas validé) : sinon elle est sautée. */
  needsTarget?: boolean;
};

export const TOUR_VERSION = 1;
/** Événement qui relance la visite de l'espace affiché (entrée « Revoir la visite guidée » du menu du compte). */
export const TOUR_RESTART_EVENT = "ecarnet:tour-restart";

const ACCOUNT_STEP: TourStep = {
  id: "account", target: "account", icon: "user", tag: "Votre compte", title: "Profil, thème et aide",
  text: "Le menu de votre compte regroupe votre profil, vos paramètres et le centre d’aide. Vous pouvez aussi y revoir cette visite guidée à tout moment.",
};

const STEPS: Record<TourSpace, TourStep[]> = {
  patient: [
    { id: "welcome", icon: "sparkle", tag: "Bienvenue", title: "Faisons le tour de votre carnet", text: "En quelques étapes, découvrez à quoi sert chaque onglet. Vous pouvez quitter quand vous voulez : rien n’est modifié." },
    { id: "home", target: "nav-home", icon: "home", tag: "Accueil", title: "Votre point de départ", text: "Votre carte d’urgence, les prochaines étapes pour compléter votre carnet et vos rappels. C’est ici que vous revenez à chaque connexion." },
    { id: "carnet", target: "nav-carnet", icon: "folder", tag: "Mon carnet", title: "Tout votre dossier de santé", text: "Allergies, antécédents, traitements, vaccins et documents (ordonnances, résultats). Vous le remplissez à votre rythme : seul ce que vous ajoutez y figure." },
    { id: "visits", target: "nav-consultations", icon: "stethoscope", tag: "Visites", title: "Vos consultations", text: "Retrouvez l’historique de vos visites et préparez la prochaine : notez ce que vous ressentez, le professionnel le verra." },
    { id: "share", target: "nav-acces", icon: "share", tag: "Partage", title: "Vous décidez qui voit quoi", text: "Présentez un QR valable 5 minutes à un professionnel pour l’autoriser, choisissez ce qu’il peut consulter et retirez l’accès quand vous voulez. Votre carte d’urgence est aussi ici." },
    { id: "notifications", target: "notifications", icon: "bell", tag: "Notifications", title: "Restez informé", text: "Visites, accès, vaccins et traitements : les alertes s’affichent ici, avec une sonnerie que vous pouvez couper.", needsTarget: true },
    ACCOUNT_STEP,
  ],
  professional: [
    { id: "welcome", icon: "sparkle", tag: "Bienvenue", title: "Bienvenue dans l’espace professionnel", text: "En quelques étapes : rejoindre votre établissement, puis consulter les dossiers que vos patients vous autorisent. Rien n’est modifié pendant la visite." },
    { id: "home", target: "nav-home", icon: "home", tag: "Accueil", title: "Votre tableau de départ", text: "Votre profil, l’état de votre rattachement et ce qu’il reste à faire pour commencer." },
    { id: "attachment", target: "nav-acces", icon: "building", tag: "Rattachement", title: "D’abord, rejoindre un établissement", text: "Saisissez le code remis par votre établissement. Tant qu’il n’est pas validé, les onglets Patients et Suivi restent masqués ; ils apparaissent dès que le rattachement est actif." },
    { id: "patients", target: "nav-patients", icon: "search", tag: "Patients", title: "Accéder à un dossier", text: "Le patient présente son QR (valable 5 minutes) : vous ne voyez que ce qu’il vous autorise, pour une durée limitée. Chaque accès est tracé.", needsTarget: true },
    { id: "followup", target: "nav-consultations", icon: "stethoscope", tag: "Suivi", title: "Consultations, ordonnances, suivi", text: "Enregistrez vos consultations, rédigez des ordonnances (avec votre cachet et votre signature) et planifiez le suivi de vos patients.", needsTarget: true },
    { ...ACCOUNT_STEP, text: "Profil, cachet et signature, thème et aide : tout est dans le menu de votre compte. « Changer d’espace » vous mène à votre espace patient, et vous pouvez y revoir cette visite guidée." },
  ],
  establishment: [
    { id: "welcome", icon: "sparkle", tag: "Bienvenue", title: "Bienvenue dans l’espace établissement", text: "Voici comment accueillir vos médecins et suivre leurs rattachements. Rien n’est modifié pendant la visite." },
    { id: "home", target: "nav-home", icon: "home", tag: "Accueil", title: "Vue d’ensemble", text: "C’est ici que vous créez le code à remettre à un médecin : il est valable 48 heures et ne sert qu’une fois." },
    { id: "team", target: "nav-equipe", icon: "users", tag: "Équipe", title: "Vos médecins et administrateurs", text: "La liste des médecins rattachés à votre établissement et de ses administrateurs." },
    { id: "requests", target: "nav-demandes", icon: "document", tag: "Demandes", title: "Confirmer un rattachement", text: "Un médecin qui saisit votre code apparaît ici. Après vos vérifications internes, vous confirmez ou refusez, et chaque décision est conservée.", needsTarget: true },
    { id: "settings", target: "nav-parametres", icon: "sliders", tag: "Paramètres", title: "Pré-consultation et ordonnances", text: "Réglez le questionnaire de pré-consultation, le modèle d’ordonnance et les informations de votre établissement.", needsTarget: true },
    { ...ACCOUNT_STEP, text: "Votre compte, le centre d’aide et la déconnexion se trouvent dans le menu du compte. Vous pouvez aussi y revoir cette visite guidée." },
  ],
};

export function tourSteps(space: TourSpace): TourStep[] {
  return STEPS[space].map((step) => ({ ...step }));
}

/** Ne garde que les étapes affichables : celles qui n'exigent pas de repère, ou dont le repère est présent. */
export function availableSteps(steps: TourStep[], hasTarget: (target: string) => boolean): TourStep[] {
  return steps.filter((step) => !step.needsTarget || (step.target !== undefined && hasTarget(step.target)));
}

/* ---------- Mémoire « visite déjà faite » ----------
   Propre au compte et à l'espace, dans le navigateur de l'appareil (comme la copie locale du thème). Effacer les données du site supprime
   la mémoire — et le choix des cookies — : la visite reprend alors toute seule à la connexion suivante. */
export function tourStorageKey(accountId: string, space: TourSpace): string {
  return `ecarnet.tour.v${TOUR_VERSION}.${accountId}.${space}`;
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function hasSeenTour(storage: StorageLike | null, accountId: string, space: TourSpace): boolean {
  if (!storage) return true; // sans mémoire possible (navigation privée stricte), on ne rejoue pas la visite à chaque page
  try { return storage.getItem(tourStorageKey(accountId, space)) !== null; } catch { return true; }
}

export function markTourSeen(storage: StorageLike | null, accountId: string, space: TourSpace): void {
  try { storage?.setItem(tourStorageKey(accountId, space), new Date().toISOString().slice(0, 10)); } catch { /* mémoire indisponible : la visite pourra se rejouer */ }
}

export function resetTour(storage: StorageLike | null, accountId: string, space: TourSpace): void {
  try { storage?.removeItem(tourStorageKey(accountId, space)); } catch { /* rien à effacer */ }
}

/* ---------- Placement de la carte ---------- */
export type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
export type Placement = { left: number; top: number; side: "right" | "left" | "below" | "above" | "center" };

export function padRect(rect: Rect, pad: number): Rect {
  return { left: rect.left - pad, top: rect.top - pad, right: rect.right + pad, bottom: rect.bottom + pad, width: rect.width + pad * 2, height: rect.height + pad * 2 };
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

/** Place la carte à côté du repère sans le recouvrir et sans sortir de l'écran. Sans repère : au centre.
    Ordre de préférence : à droite (barre latérale PC), au-dessus (barre basse mobile), en dessous, à gauche. */
export function placeCard(args: { target: Rect | null; card: { width: number; height: number }; viewport: { width: number; height: number }; gap?: number; margin?: number }): Placement {
  const { target, card, viewport } = args;
  const gap = args.gap ?? 16;
  const margin = args.margin ?? 12;
  const maxLeft = viewport.width - card.width - margin;
  const maxTop = viewport.height - card.height - margin;
  if (!target) return { left: clamp((viewport.width - card.width) / 2, margin, maxLeft), top: clamp((viewport.height - card.height) / 2, margin, maxTop), side: "center" };
  const fitsRight = target.right + gap + card.width <= viewport.width - margin;
  const fitsLeft = target.left - gap - card.width >= margin;
  const fitsAbove = target.top - gap - card.height >= margin;
  const fitsBelow = target.bottom + gap + card.height <= viewport.height - margin;
  const centeredTop = clamp(target.top + target.height / 2 - card.height / 2, margin, maxTop);
  const centeredLeft = clamp(target.left + target.width / 2 - card.width / 2, margin, maxLeft);
  // Cible étroite à gauche de l'écran (barre latérale) : la carte va à droite. Sinon, au-dessus ou en dessous, selon la place.
  if (fitsRight && target.left < viewport.width / 3 && target.width < viewport.width / 2) return { left: target.right + gap, top: centeredTop, side: "right" };
  if (fitsAbove && target.top > viewport.height / 2) return { left: centeredLeft, top: target.top - gap - card.height, side: "above" };
  if (fitsBelow) return { left: centeredLeft, top: target.bottom + gap, side: "below" };
  if (fitsAbove) return { left: centeredLeft, top: target.top - gap - card.height, side: "above" };
  if (fitsRight) return { left: target.right + gap, top: centeredTop, side: "right" };
  if (fitsLeft) return { left: target.left - gap - card.width, top: centeredTop, side: "left" };
  return { left: clamp(centeredLeft, margin, maxLeft), top: clamp(viewport.height - card.height - margin, margin, maxTop), side: "above" };
}
