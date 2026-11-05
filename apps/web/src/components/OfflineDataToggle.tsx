"use client";

import { useEffect, useState } from "react";
import { purgeOfflineCache, resetOfflineCacheEnabledMemo } from "../lib/offline-cache";
import { isOfflineSnapshotEnabled, purgeOfflineSnapshot, setOfflineSnapshotEnabled } from "../lib/offline-snapshot";
import { SNAPSHOT_MAX_AGE_MS, THIRD_PARTY_CACHE_MAX_AGE_MS } from "../lib/offline-policy";

const days = (ms: number) => Math.round(ms / 86_400_000);

/**
 * Réglage « Hors connexion » : copie CHIFFRÉE de ce que vous avez consulté, pour naviguer sans réseau en lecture seule, avec effacement immédiat.
 * `third-party` : espaces professionnel et établissement (la copie contient des données de patients : durée plus courte).
 */
export function OfflineDataToggle({ audience = "patient" }: { audience?: "patient" | "third-party" }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const thirdParty = audience === "third-party";
  const lifetime = thirdParty ? `${days(THIRD_PARTY_CACHE_MAX_AGE_MS)} jour` : `${days(SNAPSHOT_MAX_AGE_MS)} jours`;

  useEffect(() => {
    let active = true;
    void isOfflineSnapshotEnabled().then((value) => { if (active) setEnabled(value); });
    return () => { active = false; };
  }, []);

  async function toggle() {
    if (enabled === null) return;
    const next = !enabled;
    setEnabled(null);
    await setOfflineSnapshotEnabled(next); // efface l'ancienne copie en clair si on coupe
    if (!next) await purgeOfflineCache();
    resetOfflineCacheEnabledMemo();
    setEnabled(next);
    setMessage(next ? "Activé. Les écrans que vous ouvrez en ligne seront enregistrés, chiffrés, sur cet appareil." : "Désactivé. La copie a été effacée de cet appareil.");
  }

  async function erase() {
    await purgeOfflineSnapshot();
    await purgeOfflineCache();
    setMessage("La copie a été effacée de cet appareil.");
  }

  return (
    <div className="settings-modal-section">
      <span className="eyebrow">Sur cet appareil</span>
      <p className="muted">
        {thirdParty
          ? "Sans connexion, vous pouvez ouvrir l’application et relire les écrans déjà consultés, en lecture seule, y compris les informations de patients que vous avez ouvertes. Elles sont chiffrées sur l’appareil. Aucune action (création, modification, validation) n’est possible sans réseau."
          : "Sans connexion, vous pouvez ouvrir l’application, les pages d’information et les écrans que vous avez déjà consultés (déclarations, carnet, historique, paramètres), en lecture seule. Ils sont chiffrés sur l’appareil. Aucune modification n’est possible sans réseau."}
      </p>
      <div className="actions">
        <button type="button" className={enabled ? "button ghost" : "button primary"} disabled={enabled === null} aria-pressed={enabled === true} onClick={() => void toggle()}>
          {enabled === null ? "Un instant…" : enabled ? "Désactiver la copie hors connexion" : "Activer la copie hors connexion"}
        </button>
        <button type="button" className="button ghost" onClick={() => void erase()}>Effacer de cet appareil</button>
      </div>
      <p className="muted" role="status">{message || `La copie est effacée à la déconnexion, au changement de compte ou de profil, et au bout de ${lifetime} sans visite en ligne. Sur un appareil partagé, désactivez-la.`}</p>
    </div>
  );
}
