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
};

const NetworkContext = createContext<NetworkValue>({ online: true, phase: "online", servedFromCopyAt: null, recheck: async () => true });
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
      setPhase("restored");
      restoreTimer.current = window.setTimeout(() => { setPhase("online"); servedRef.current = null; setServedFromCopyAt(null); }, servedRef.current ? RESTORED_WITH_REFRESH_MS : RESTORED_BANNER_MS);
      window.dispatchEvent(new Event(NETWORK_RESTORED_EVENT));
    } else {
      setPhase("offline");
    }
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
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    window.addEventListener(NETWORK_FAILURE_EVENT, onFailure);
    window.addEventListener(SERVED_FROM_COPY_EVENT, onServed);
    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void recheck(); }, HEARTBEAT_INTERVAL_MS);
    return () => {
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

  const value = useMemo<NetworkValue>(() => ({ online, phase, servedFromCopyAt, recheck }), [online, phase, servedFromCopyAt, recheck]);
  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}
