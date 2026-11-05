/**
 * Retour en haut de page quand on ouvre une nouvelle page depuis une « zone de navigation » : pied de page public, barre de navigation
 * des espaces (barre basse mobile, sidebar, menu du compte), lien « Aide » et liste « En savoir plus » des paramètres.
 * Sans dépendance (testable en Node) ; le composant `ScrollToTopOnNavigate` pose les écouteurs et lit/écrit le stockage de session.
 *
 * Pourquoi un repère mémorisé : au clic, la page n'est pas encore celle de destination ; le repère laisse la nouvelle page se monter,
 * puis elle se replace en haut une fois la transition du routeur et du défilement doux terminée. Les liens avec ancre (#section)
 * gardent leur cible.
 */
export const PENDING_SCROLL_KEY = "ecarnet:pending-footer-scroll";
export const PENDING_SCROLL_MAX_AGE_MS = 10_000;
/** Zones dont les liens ouvrent la page de destination en haut. */
export const SCROLL_TOP_ZONES = '[data-footer-zone="true"], [data-scroll-top="true"]';

export type ClickInfo = {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  /** `link.href` (adresse absolue résolue par le navigateur). */
  href: string;
  /** `window.location.href`. */
  base: string;
  /** `link.target`. */
  target: string;
  download: boolean;
};

export type ClickDecision =
  | { action: "ignore" }
  /** Remonter tout de suite ; `remember` = chemin de la page de destination à retenir, `null` = effacer un repère périmé. */
  | { action: "scroll"; remember: string | null };

export function decideScrollOnClick(click: ClickInfo): ClickDecision {
  if (click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return { action: "ignore" };
  if ((click.target && click.target !== "_self") || click.download) return { action: "ignore" };
  let destination: URL;
  let current: URL;
  try {
    destination = new URL(click.href, click.base);
    current = new URL(click.base);
  } catch {
    return { action: "ignore" };
  }
  if (destination.origin !== current.origin || destination.hash) return { action: "ignore" };
  return { action: "scroll", remember: destination.pathname !== current.pathname ? destination.pathname : null };
}

export function serializePendingScroll(pathname: string, now: number): string {
  return JSON.stringify({ pathname, createdAt: now });
}

export type PendingState = "none" | "invalid" | "expired" | "other-page" | "scroll";

/** `scroll` : la page de destination est montée, on remonte. `other-page` : le routeur n'a pas encore changé l'adresse, on garde le repère. */
export function readPendingScroll(raw: string | null, pathname: string, now: number): PendingState {
  if (!raw) return "none";
  let pending: unknown;
  try { pending = JSON.parse(raw); } catch { return "invalid"; }
  if (typeof pending !== "object" || pending === null) return "invalid";
  const { pathname: target, createdAt } = pending as { pathname?: unknown; createdAt?: unknown };
  if (typeof target !== "string" || typeof createdAt !== "number" || !Number.isFinite(createdAt)) return "invalid";
  if (now - createdAt > PENDING_SCROLL_MAX_AGE_MS) return "expired";
  return target === pathname ? "scroll" : "other-page";
}
