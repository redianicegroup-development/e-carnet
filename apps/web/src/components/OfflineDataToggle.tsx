"use client";

import { useEffect, useState } from "react";
import { isOfflineSnapshotEnabled, purgeOfflineSnapshot, setOfflineSnapshotEnabled } from "../lib/offline-snapshot";

/** Réglage « Hors connexion » : copie des déclarations en lecture seule sur cet appareil, avec effacement immédiat. */
export function OfflineDataToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void isOfflineSnapshotEnabled().then((value) => { if (active) setEnabled(value); });
    return () => { active = false; };
  }, []);

  async function toggle() {
    if (enabled === null) return;
    const next = !enabled;
    setEnabled(null);
    await setOfflineSnapshotEnabled(next);
    setEnabled(next);
    setMessage(next ? "Activé. Vos déclarations seront enregistrées sur cet appareil à votre prochaine visite en ligne." : "Désactivé. La copie de vos déclarations a été effacée de cet appareil.");
  }

  async function erase() {
    await purgeOfflineSnapshot();
    setMessage("La copie de vos déclarations a été effacée de cet appareil.");
  }

  return (
    <div className="settings-modal-section">
      <span className="eyebrow">Sur cet appareil</span>
      <p className="muted">Sans connexion, vous pouvez ouvrir l’application et consulter vos déclarations, et celles des profils enfants que vous avez ouverts, en lecture seule. L’historique, les consultations, les documents et l’agenda ne sont jamais conservés sur l’appareil.</p>
      <div className="actions">
        <button type="button" className={enabled ? "button ghost" : "button primary"} disabled={enabled === null} aria-pressed={enabled === true} onClick={() => void toggle()}>
          {enabled === null ? "Un instant…" : enabled ? "Désactiver la copie hors connexion" : "Activer la copie hors connexion"}
        </button>
        <button type="button" className="button ghost" onClick={() => void erase()}>Effacer de cet appareil</button>
      </div>
      <p className="muted" role="status">{message || "La copie est effacée à la déconnexion et au bout de 7 jours sans visite en ligne. Sur un appareil partagé, désactivez-la."}</p>
    </div>
  );
}
