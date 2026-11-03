"use client";

import { useEffect } from "react";
import { purgeExpiredOfflineData } from "../lib/offline-snapshot";
import { syncOfflineSnapshot, type OfflineSyncAccount } from "../lib/offline-sync";

const SETTLE_MS = 1500;

/** Sans rendu : garde à jour la copie locale des déclarations pendant que l'espace patient est ouvert en ligne. */
export function OfflineSnapshotSync({ account }: { account: OfflineSyncAccount }) {
  const accountId = account.id;
  const profileId = account.patient_profile.id;
  const firstName = account.first_name;
  const lastName = account.last_name;

  useEffect(() => {
    const current: OfflineSyncAccount = { id: accountId, first_name: firstName, last_name: lastName, patient_profile: { id: profileId } };
    let timer: number | undefined;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { void syncOfflineSnapshot(current); }, SETTLE_MS);
    };
    void purgeExpiredOfflineData();
    schedule();
    // Changement de profil enfant, déclaration ajoutée ou retirée, retour de la connexion.
    const events = ["ecarnet:patient-profile-changed", "ecarnet:product-action-completed"];
    events.forEach((name) => window.addEventListener(name, schedule));
    window.addEventListener("online", schedule);
    return () => {
      window.clearTimeout(timer);
      events.forEach((name) => window.removeEventListener(name, schedule));
      window.removeEventListener("online", schedule);
    };
  }, [accountId, profileId, firstName, lastName]);

  return null;
}
