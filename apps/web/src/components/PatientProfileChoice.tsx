"use client";

import { useState } from "react";
import { CHILD_LABEL, HOLDER_LABEL, profileInitials, profileName, selectProfile } from "../lib/patient-profiles";
import { initials, useSpaceAccount } from "./shell/SpaceShell";
import { usePatientProfiles } from "./usePatientProfiles";
import "./patient-profiles.css";

/* « Pour qui ? » en tête d'une consultation ou d'une pré-consultation : soi-même (le titulaire) ou l'un des profils d'enfants du compte.
   Choisir un profil l'ouvre (même mécanisme que la flèche des paramètres) : la pré-consultation et l'accès temporaire qui suivent sont ceux de ce profil.
   Rien ne s'affiche tant que le compte n'a aucun profil d'enfant. */
export function PatientProfileChoice() {
  const { usable, active, ready } = usePatientProfiles();
  const account = useSpaceAccount();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (!ready || usable.length === 0) return null;

  async function choose(patientId: string | null) {
    if ((active?.patient_id ?? null) === patientId || busy) return;
    setBusy(true);
    setMessage("");
    try { await selectProfile(patientId); } catch (error) { setMessage(error instanceof Error ? error.message : "Impossible de changer de profil pour le moment."); } finally { setBusy(false); }
  }

  const holderName = account ? [account.first_name, account.last_name].filter(Boolean).join(" ") || "Moi" : "Moi";
  return (
    <fieldset className="profile-choice" data-tour="profile-choice">
      <legend>Pour qui est cette consultation ?</legend>
      <div className="profile-choice__options">
        <button type="button" className="profile-choice__option" aria-pressed={!active} disabled={busy} onClick={() => void choose(null)}>
          <span className="profile-menu__avatar" aria-hidden="true">{account ? initials(account) : "MOI"}</span>
          <span>{holderName} <small className="muted">· {HOLDER_LABEL}</small></span>
        </button>
        {usable.map((profile) => (
          <button type="button" key={profile.patient_id} className="profile-choice__option" aria-pressed={profile.patient_id === active?.patient_id} disabled={busy} onClick={() => void choose(profile.patient_id)}>
            <span className="profile-menu__avatar" aria-hidden="true">{profileInitials(profile)}</span>
            <span>{profileName(profile)} <small className="muted">· {CHILD_LABEL}</small></span>
          </button>
        ))}
      </div>
      {message && <p className="status" role="status">{message}</p>}
    </fieldset>
  );
}
