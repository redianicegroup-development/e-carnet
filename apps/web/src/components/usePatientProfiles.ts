"use client";

import { useCallback, useEffect, useState } from "react";
import { listProfiles, PROFILE_CHANGED_EVENT, PROFILES_UPDATED_EVENT, usableProfiles, type PatientProfileEntry } from "../lib/patient-profiles";

/** Les profils du compte patient : `usable` (liens actifs), `active` (le profil d'enfant ouvert, ou null pour le titulaire).
    Se met à jour tout seul quand le profil change ailleurs dans l'application. */
export function usePatientProfiles() {
  const [profiles, setProfiles] = useState<PatientProfileEntry[]>([]);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    try { setProfiles(await listProfiles()); } catch { /* sans profils chargés, le titulaire reste le seul profil proposé */ }
    setReady(true);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronise la liste avec le serveur après montage et à chaque changement de profil.
  useEffect(() => { void reload(); const listener = () => void reload(); window.addEventListener(PROFILE_CHANGED_EVENT, listener); window.addEventListener(PROFILES_UPDATED_EVENT, listener); return () => { window.removeEventListener(PROFILE_CHANGED_EVENT, listener); window.removeEventListener(PROFILES_UPDATED_EVENT, listener); }; }, [reload]);

  const usable = usableProfiles(profiles);
  const active = usable.find((profile) => profile.is_active) ?? null;
  return { profiles, usable, active, ready, reload };
}
