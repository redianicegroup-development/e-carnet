"use client";

// Import à effet de bord : pose le relais `fetch` (copie chiffrée, erreurs lisibles) AVANT les effets des composants enfants.
import "../../lib/offline-fetch";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_PATH,
  HEARTBEAT_TIMEOUT_MS,
  NETWORK_FAILURE_EVENT,
  NETWORK_RESTORED_EVENT,
  RESTORED_BANNER_MS,
  RESTORED_WITH_REFRESH_MS,
  SERVED_FROM_COPY_EVENT,
  isOfflineVerdict,
  pingVerdictFromError,
  type PingVerdict,
} from "../../lib/network-status";

export type NetworkPhase = "online" | "offline" | "restored";
export type NetworkValue = {
  /** Faux seulement quand l'appareil n'atteint pas le site (jamais pour un serveur lent ou qui se réveille). */
  online: boolean;
  phase: NetworkPhase;
  /** Date (ms) de la copie locale affichée pendant la coupure, sinon `null`. */
  servedFromCopyAt: number | null;
  recheck: () => Promise<boolean>;
  /** Change à chaque actualisation automatique au retour de la connexion : l'espace remonte ses pages, qui relisent leurs données. */
  refreshKey: number;
  /** Vrai quand des saisies en cours empêchent l'actualisation automatique (rien n'est effacé) : le bandeau propose « Actualiser ». */
  refreshPending: boolean;
  /** Vrai juste après une actualisation automatique. */
  refreshed: boolean;
  refreshNow: () => void;
};

const NetworkContext = createContext<NetworkValue>({ online: true, phase: "online", servedFromCopyAt: null, recheck: async () => true, refreshKey: 0, refreshPending: false, refreshed: false, refreshNow: () => {} });

/* Saisies en cours : un champ de formulaire modifié par la personne. À la reconnexion, on n'actualise pas automatiquement tant qu'une saisie
   non enregistrée est à l'écran (une consultation rédigée hors connexion ne doit jamais disparaître). */
type EditableField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
const editedFields = new Set<EditableField>();
function trackEdit(event: Event) {
  const field = event.target;
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return;
  if (field instanceof HTMLInputElement && ["search", "button", "submit", "reset"].includes(field.type)) return;
  if (field.closest("form")) editedFields.add(field);
}
function hasUnsavedInput(): boolean {
  for (const field of Array.from(editedFields)) {
    if (!field.isConnected) { editedFields.delete(field); continue; }
    if (field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio")) { if (field.checked) return true; continue; }
    if (field instanceof HTMLInputElement && field.type === "file") { if (field.files && field.files.length > 0) return true; continue; }
    if (field.value.trim()) return true;
  }
  return false;
}
/** Une coupure plus courte que cela n'est qu'un battement de réseau : pas d'actualisation. */
const MIN_OFFLINE_FOR_REFRESH_MS = 2_000;
export const useNetwork = () => useContext(NetworkContext);

async function ping(): Promise<PingVerdict> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS);
  try {
    await fetch(HEARTBEAT_PATH, { cache: "no-store", credentials: "omit", signal: controller.signal });
    return "ok"; // une réponse HTTP, même 502/503 : le site est joignable (le réveil du serveur est géré ailleurs)
  } catch (error) {
    return pingVerdictFromError(error);
  } finally {
    window.clearTimeout(timer);
  }
}

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(true);
  const [phase, setPhase] = useState<NetworkPhase>("online");
  const [servedFromCopyAt, setServedFromCopyAt] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshPending, setRefreshPending] = useState(false);
  const [refreshed, setRefreshed] = useState(false);
  const offlineSince = useRef<number | null>(null);
  const onlineRef = useRef(true);
  const failuresRef = useRef(0);
  const servedRef = useRef<number | null>(null);
  const restoreTimer = useRef<number | undefined>(undefined);
  const lastFailureCheck = useRef(0);

  const setConnected = useCallback((next: boolean) => {
    if (onlineRef.current === next) return;
    onlineRef.current = next;
    setOnline(next);
    window.clearTimeout(restoreTimer.current);
    if (next) {
      // Retour de la connexion : les pages relisent leurs données TOUTES SEULES, sauf s'il y a une saisie non enregistrée à l'écran.
      const offlineFor = offlineSince.current ? Date.now() - offlineSince.current : 0;
      offlineSince.current = null;
      let pending = false;
      let didRefresh = false;
      if (offlineFor >= MIN_OFFLINE_FOR_REFRESH_MS || servedRef.current !== null) {
        if (hasUnsavedInput()) pending = true;
        else { setRefreshKey((value) => value + 1); servedRef.current = null; setServedFromCopyAt(null); didRefresh = true; }
      }
      setRefreshPending(pending);
      setRefreshed(didRefresh);
      setPhase("restored");
      restoreTimer.current = window.setTimeout(() => { setPhase("online"); servedRef.current = null; setServedFromCopyAt(null); setRefreshPending(false); setRefreshed(false); }, pending ? RESTORED_WITH_REFRESH_MS : RESTORED_BANNER_MS);
      window.dispatchEvent(new Event(NETWORK_RESTORED_EVENT));
    } else {
      if (offlineSince.current === null) offlineSince.current = Date.now();
      setPhase("offline");
    }
  }, []);

  const refreshNow = useCallback(() => {
    window.clearTimeout(restoreTimer.current);
    servedRef.current = null;
    setServedFromCopyAt(null);
    setRefreshPending(false);
    setRefreshed(false);
    setRefreshKey((value) => value + 1);
    setPhase(onlineRef.current ? "online" : "offline");
  }, []);

  const recheck = useCallback(async (): Promise<boolean> => {
    if (navigator.onLine === false) { setConnected(false); return false; }
    const verdict = await ping();
    if (verdict === "ok") { failuresRef.current = 0; setConnected(true); return true; }
    if (verdict === "down") {
      failuresRef.current += 1;
      if (isOfflineVerdict(true, failuresRef.current)) setConnected(false);
    }
    return onlineRef.current;
  }, [setConnected]);

  useEffect(() => {
    // Premier état : lu juste après le montage (pas dans le corps de l'effet : pas de rendu en cascade, et l'hydratation reste identique au serveur).
    const first = window.setTimeout(() => { void recheck(); }, 0);
    const goOffline = () => setConnected(false);
    const goOnline = () => { void recheck(); };
    const onFailure = () => {
      // Un appel du site vient d'échouer sans réponse : on compte l'échec et on vérifie tout de suite (au plus une fois par seconde).
      const now = Date.now();
      if (now - lastFailureCheck.current < 1000) return;
      lastFailureCheck.current = now;
      failuresRef.current += 1;
      void recheck();
    };
    const onServed = (event: Event) => {
      const savedAt = (event as CustomEvent<{ savedAt?: number }>).detail?.savedAt;
      if (typeof savedAt !== "number") return;
      const oldest = servedRef.current === null ? savedAt : Math.min(servedRef.current, savedAt);
      servedRef.current = oldest;
      setServedFromCopyAt(oldest);
    };
    const onVisible = () => { if (document.visibilityState === "visible") void recheck(); };
    document.addEventListener("input", trackEdit, true);
    document.addEventListener("change", trackEdit, true);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    window.addEventListener(NETWORK_FAILURE_EVENT, onFailure);
    window.addEventListener(SERVED_FROM_COPY_EVENT, onServed);
    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void recheck(); }, HEARTBEAT_INTERVAL_MS);
    return () => {
      document.removeEventListener("input", trackEdit, true);
      document.removeEventListener("change", trackEdit, true);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      window.removeEventListener(NETWORK_FAILURE_EVENT, onFailure);
      window.removeEventListener(SERVED_FROM_COPY_EVENT, onServed);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
      window.clearTimeout(first);
      window.clearTimeout(restoreTimer.current);
    };
  }, [recheck, setConnected]);

  const value = useMemo<NetworkValue>(() => ({ online, phase, servedFromCopyAt, recheck, refreshKey, refreshPending, refreshed, refreshNow }), [online, phase, servedFromCopyAt, recheck, refreshKey, refreshPending, refreshed, refreshNow]);
  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}
