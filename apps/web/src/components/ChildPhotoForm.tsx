"use client";

import { useState } from "react";
import { apiPatch } from "../infrastructure/api/client";
import { PROFILES_UPDATED_EVENT, profileInitials, profileName, type PatientProfileEntry } from "../lib/patient-profiles";
import { AvatarPicker } from "./AvatarPicker";
import "./patient-profiles.css";

/* Photo de profil d'un enfant : ajouter, modifier ou retirer. Utilisé dans la fiche du profil (Paramètres > Carnet enfant) et dans « Mes informations
   personnelles » quand le compte enfant est ouvert. La photo est enregistrée sur le profil de l'enfant : le titulaire la retrouve aussitôt partout dans
   son compte (liste des profils, « Pour qui est cette consultation ? », menu de changement de profil), car tout est relu avec PROFILES_UPDATED_EVENT. */
export function ChildPhotoForm({ profile, onSaved }: { profile: PatientProfileEntry; onSaved?: () => void }) {
  const [photo, setPhoto] = useState(profile.avatar_url ?? "");
  const [changed, setChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      await apiPatch(`/api/v1/patient/representations/${profile.id}/avatar/`, { avatar_data: photo.startsWith("data:image/webp;base64,") ? photo : "" });
      setChanged(false);
      setMessage(photo ? `Photo de ${profile.first_name} enregistrée.` : `Photo de ${profile.first_name} retirée.`);
      window.dispatchEvent(new Event(PROFILES_UPDATED_EVENT));
      onSaved?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "La photo n’a pas pu être enregistrée.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="child-photo-form">
      <AvatarPicker value={photo} onChange={(value) => { setPhoto(value); setChanged(true); setMessage(""); }} fallback={profileInitials(profile)} disabled={busy} />
      <p className="muted">Photo de {profileName(profile)}. Touchez la photo pour en choisir une nouvelle.</p>
      <button className="button primary" type="button" disabled={busy || !changed} onClick={() => void save()}>{busy ? "Enregistrement…" : "Enregistrer la photo"}</button>
      <p className="status" role="status" aria-live="polite">{message}</p>
    </div>
  );
}
