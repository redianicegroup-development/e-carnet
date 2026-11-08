/* Petit bus d'événements du navigateur pour le « temps réel » des notifications.
   - REFRESH : n'importe quel morceau de l'app (ou le service worker, à la réception d'un push) demande à la cloche de vérifier tout de suite.
   - CHANGED : la cloche annonce qu'une nouvelle notification vient d'arriver ; les écrans concernés (accès, QR) se rechargent sans attendre. */
import { useEffect, useRef } from "react";

export const NOTIFICATIONS_REFRESH_EVENT = "ecarnet:notifications-refresh";
export const NOTIFICATIONS_CHANGED_EVENT = "ecarnet:notifications-changed";
/** Message posté par le service worker à chaque push reçu (voir public/sw.js). */
export const SERVICE_WORKER_PUSH_MESSAGE = "ecarnet:push-received";

export type NotificationBrief = { kind: string; title: string; body: string };
export type NotificationsChangedDetail = { kinds: string[]; items: NotificationBrief[] };

export function requestNotificationsRefresh() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
}

export function announceNewNotifications(items: NotificationBrief[]) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<NotificationsChangedDetail>(NOTIFICATIONS_CHANGED_EVENT, { detail: { kinds: items.map((item) => item.kind), items } }));
}

/** Réagit à l'arrivée de nouvelles notifications (annoncée par la cloche). `handler` peut changer à chaque rendu sans réabonner. */
export function useNewNotifications(handler: (detail: NotificationsChangedDetail) => void) {
  const latest = useRef(handler);
  useEffect(() => { latest.current = handler; });
  useEffect(() => {
    const listener = (event: Event) => latest.current((event as CustomEvent<NotificationsChangedDetail>).detail);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, listener);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, listener);
  }, []);
}

/** Vrai si une des notifications arrivées concerne les accès (ouverture, fin, demande, prolongation…). */
export function concernsAccess(kinds: string[]) {
  return kinds.some((kind) => /access|share|grant|partag/i.test(kind));
}
