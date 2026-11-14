"use client";

import { useEffect } from "react";
import { currentPushSubscription, isPushOptedOut, markPushAsked, pushServerReady, pushSupport, subscribeToPush, wasPushAsked } from "../lib/push";

/* Notifications actives par défaut (espace patient). Rien n'est fait si la personne les a coupées sur cet appareil, si le navigateur les bloque,
   ou si le serveur ne sait pas envoyer (clés VAPID absentes) : on ne demande jamais une permission pour rien.
   - permission déjà accordée mais abonnement perdu (nouvelle connexion, service worker réinitialisé) : réabonnement silencieux ;
   - permission jamais demandée : une seule demande, au premier toucher (iOS exige un geste), puis plus jamais de relance automatique. */
export function PushAutoEnable() {
  useEffect(() => {
    if (pushSupport() !== "ok" || isPushOptedOut() || Notification.permission === "denied") return;
    let active = true;
    let detach = () => {};
    (async () => {
      if (!(await pushServerReady()) || !active) return;
      if (Notification.permission === "granted") {
        const existing = await currentPushSubscription().catch(() => null);
        if (!existing && active) await subscribeToPush();
        return;
      }
      if (wasPushAsked() || !active) return;
      const onFirstTap = () => { markPushAsked(); void subscribeToPush(); };
      window.addEventListener("pointerup", onFirstTap, { once: true });
      detach = () => window.removeEventListener("pointerup", onFirstTap);
    })();
    return () => { active = false; detach(); };
  }, []);
  return null;
}
