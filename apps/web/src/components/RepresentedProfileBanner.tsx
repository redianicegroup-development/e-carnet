"use client";

import { useState } from "react";
import { CHILD_LABEL, profileName, selectProfile } from "../lib/patient-profiles";
import { usePatientProfiles } from "./usePatientProfiles";
import "./patient-profiles.css";

/* Bandeau « Compte enfant » : tant qu'un profil d'enfant est ouvert, chaque page du compte patient le rappelle, pour qu'on ne note jamais une mesure
   ou une déclaration dans le mauvais carnet. Même présentation que le bandeau d'un proche de confiance (carnet d'une autre personne). */
export function RepresentedProfileBanner() {
  const { active } = usePatientProfiles();
  const [message, setMessage] = useState("");
  if (!active) return null;
  async function back() {
    try { await selectProfile(null); setMessage(""); } catch { setMessage("Impossible de revenir à votre compte pour le moment."); }
  }
  return (
    <aside className="notice trusted-delegation-banner represented-banner" role="status" aria-label={CHILD_LABEL}>
      <p><span className="eyebrow">{CHILD_LABEL}</span> <strong>{profileName(active)}</strong> · chaque accès à ce dossier est journalisé.</p>
      <button className="button small" type="button" onClick={() => void back()}>Revenir à mon compte</button>
      {message && <p className="status">{message}</p>}
    </aside>
  );
}
