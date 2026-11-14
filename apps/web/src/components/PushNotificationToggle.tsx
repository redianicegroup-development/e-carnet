"use client";

import { useEffect, useState } from "react";
import { currentPushSubscription, pushServerReady, pushSupport, setPushOptOut, subscribeToPush, unsubscribeFromPush } from "../lib/push";

type State = "loading" | "off" | "on" | "denied" | "unsupported" | "ios-install" | "unavailable" | "error";

const MESSAGES: Partial<Record<State, string>> = {
  denied: "Les notifications sont bloquées pour ce site. Autorisez-les dans les réglages de votre navigateur, puis réessayez.",
  "ios-install": "Sur iPhone et iPad, ajoutez d’abord Mon E‑Carnet à l’écran d’accueil (Partager, puis « Sur l’écran d’accueil »), puis rouvrez l’application depuis cette icône pour activer les notifications.",
  unsupported: "Ce navigateur ne permet pas les notifications. Vos rappels restent visibles dans l’application.",
  unavailable: "Les notifications sur l’appareil ne sont pas encore disponibles. Vos rappels restent visibles dans l’application.",
  error: "Activation impossible pour le moment. Réessayez dans un instant.",
};

/** Notifications actives par défaut : l'application s'abonne toute seule (voir PushAutoEnable). Ici, la personne peut les couper sur cet appareil ; son choix est respecté. */
export function PushNotificationToggle() {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let active = true;
    (async () => {
      const support = pushSupport();
      if (support !== "ok") return active && setState(support === "ios-install" ? "ios-install" : "unsupported");
      if (Notification.permission === "denied") return active && setState("denied");
      const subscription = await currentPushSubscription().catch(() => null);
      if (subscription && Notification.permission === "granted") return active && setState("on");
      // Pas d'abonnement : on le dit tout de suite si le serveur ne sait pas envoyer, au lieu d'un bouton qui échouerait.
      const ready = await pushServerReady();
      if (active) setState(ready ? "off" : "unavailable");
    })();
    return () => { active = false; };
  }, []);

  async function toggle() {
    if (state === "on") {
      setState("loading");
      setPushOptOut(true); // choix explicite : plus d'abonnement automatique sur cet appareil
      await unsubscribeFromPush();
      setState("off");
      return;
    }
    setState("loading");
    setPushOptOut(false);
    const result = await subscribeToPush(); // directement dans le clic : exigé par iOS
    setState(result === "subscribed" ? "on" : result === "denied" ? "denied" : result === "unavailable" ? "unavailable" : "error");
  }

  const canToggle = state === "off" || state === "on" || state === "error" || state === "loading";
  return (
    <div className="settings-modal-section">
      <span className="eyebrow">Sur cet appareil</span>
      {canToggle && (
        <div className="actions">
          <button type="button" className={state === "on" ? "button ghost" : "button primary"} disabled={state === "loading"} aria-pressed={state === "on"} onClick={toggle}>
            {state === "loading" ? "Un instant…" : state === "on" ? "Désactiver les notifications" : "Activer les notifications"}
          </button>
        </div>
      )}
      <p className="muted" role="status">
        {MESSAGES[state] ?? (state === "on"
          ? "Activées sur cet appareil. Par confidentialité, la notification n’affiche jamais le nom du médicament : le détail est dans l’application."
          : "Recevez un signal sur cet appareil quand un rappel arrive, même si l’application est fermée.")}
      </p>
    </div>
  );
}
