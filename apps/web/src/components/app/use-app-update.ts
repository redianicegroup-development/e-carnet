"use client";

import { useCallback, useEffect, useState } from "react";
import { APP_BUILD, fetchLatestBuild, statusFor, type LatestBuild, type UpdateStatus } from "../../lib/app-info";

/** Compare le code qui tourne ici à celui que le serveur sert maintenant. Revérifie quand l'application revient au premier plan. */
export function useAppUpdate() {
  const [status, setStatus] = useState<UpdateStatus>("checking");
  const [latest, setLatest] = useState<LatestBuild | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const run = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker?.getRegistration();
      void registration?.update().catch(() => undefined); // le service worker se met à jour de son côté
      const info = await fetchLatestBuild();
      setLatest(info);
      setCheckedAt(new Date());
      setStatus(statusFor(APP_BUILD, info?.build));
    } catch {
      setStatus(navigator.onLine ? "unknown" : "offline");
    }
  }, []);

  useEffect(() => {
    const first = window.setTimeout(() => void run(), 0); // première vérification juste après l'affichage
    const onVisible = () => { if (document.visibilityState === "visible") void run(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearTimeout(first); document.removeEventListener("visibilitychange", onVisible); };
  }, [run]);

  const recheck = useCallback(() => { setStatus("checking"); void run(); }, [run]);

  /** Recharge l'application : les pages sont servies réseau d'abord, la nouvelle version est donc celle qui arrive. */
  const apply = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker?.getRegistration();
      await registration?.update();
    } catch { /* la page rechargée récupérera la dernière version */ }
    window.location.reload();
  }, []);

  return { status, latest, checkedAt, recheck, apply };
}
