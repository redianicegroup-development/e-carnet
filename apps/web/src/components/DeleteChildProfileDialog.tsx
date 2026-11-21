"use client";

import { useState, type FormEvent } from "react";
import { apiPost } from "../infrastructure/api/client";
import { PROFILE_CHANGED_EVENT, PROFILES_UPDATED_EVENT, profileName, type PatientProfileEntry } from "../lib/patient-profiles";
import { useConfirm } from "./modal/ConfirmProvider";
import { OutcomeDialog, type OutcomeDialogProps } from "./modal/OutcomeDialog";
import { PanelDialog } from "./modal/PanelDialog";
import "./patient-profiles.css";

/* Suppression d'un carnet enfant, avec motif. Mêmes motifs que la suppression d'un compte. Déroulé : 1) le motif 2) une fenêtre de CONFIRMATION avec avertissement
   (suppression immédiate et irréversible, données effacées de la base) 3) le résultat (réussite ou échec) dans un modal. Côté serveur : child_deletion.py et erasure.py. */
const REASONS: Array<{ value: string; label: string }> = [
  { value: "not_needed", label: "Je n’ai plus besoin de ce profil" },
  { value: "duplicate", label: "Ce profil existe en double" },
  { value: "privacy", label: "Motif lié à la confidentialité" },
  { value: "experience", label: "Mon expérience ne correspond pas à mes besoins" },
  { value: "other", label: "Autre motif" },
];
const FALLBACK = "Le profil n’a pas pu être supprimé. Réessayez dans un instant.";

export function DeleteChildProfileDialog({ profile, onClose, onDeleted }: { profile: PatientProfileEntry; onClose: () => void; onDeleted: () => void }) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [outcome, setOutcome] = useState<Omit<OutcomeDialogProps, "onClose"> | null>(null);
  const name = profileName(profile);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason) { setMessage("Choisissez un motif."); return; }
    if (reason === "other" && !details.trim()) { setMessage("Précisez votre autre motif."); return; }
    const accepted = await confirm({
      title: `Supprimer définitivement le carnet de ${profile.first_name} ?`,
      message: `Toutes les données de ${name} seront effacées de la base immédiatement : identité, photo, déclarations, documents, vaccins, mesures, rappels, plans de suivi, rendez-vous, consultations et carte d’urgence.`,
      note: "Cette action est irréversible : rien ne pourra être récupéré, ni par vous, ni par l’équipe. Seules des traces techniques protégées (journal d’accès), vidées de leur contenu et sans identité, sont conservées.",
      confirmLabel: "Supprimer définitivement",
      cancelLabel: "Garder ce carnet",
      tone: "danger",
      mood: "farewell",
    });
    if (!accepted) return;
    setBusy(true);
    setMessage("");
    try {
      await apiPost(`/api/v1/patient/representations/${profile.id}/delete/`, { reason, details: reason === "other" ? details.trim() : "", confirm: true });
      window.dispatchEvent(new Event(profile.is_active ? PROFILE_CHANGED_EVENT : PROFILES_UPDATED_EVENT));
      setOutcome({ tone: "success", title: "Profil supprimé", message: `Le profil de ${name} est supprimé.`, note: "Toutes ses données ont été effacées de la base. Cette suppression est irréversible : rien ne peut être récupéré." });
    } catch (error) {
      const failed = error instanceof Error && error.message ? error.message : FALLBACK;
      setMessage(failed);
      setOutcome({ tone: "error", title: "Profil non supprimé", message: failed });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PanelDialog title={`Supprimer le profil de ${profile.first_name}`} lead="La suppression est immédiate et irréversible : les données sont effacées de la base et ne peuvent pas être récupérées." onClose={onClose}>
        <form className="settings-form delete-child" onSubmit={(event) => void submit(event)}>
          <p className="notice" role="note"><strong>Attention : cette suppression est irréversible.</strong> Les données de {name} sont effacées de la base immédiatement : identité, photo, déclarations, documents, vaccins, mesures, rappels, plans de suivi, rendez-vous, consultations et carte d’urgence. Les accès ouverts sont retirés. Seules des traces techniques protégées (journal d’accès), vidées de leur contenu et sans identité, sont conservées.</p>
          <label className="field"><span>Motif de la suppression</span>
            <select required value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy}>
              <option value="">Choisissez un motif</option>
              {REASONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          {reason === "other" && <label className="field"><span>Précisez votre motif</span><textarea required maxLength={1200} rows={3} value={details} onChange={(event) => setDetails(event.target.value)} disabled={busy} /></label>}
          <div className="child-onboarding__actions">
            <button className="button danger" type="submit" disabled={busy}>{busy ? "Suppression…" : "Supprimer le carnet"}</button>
            <button className="button" type="button" disabled={busy} onClick={onClose}>Garder ce profil</button>
          </div>
          <p className="status" role="status" aria-live="polite">{message}</p>
        </form>
      </PanelDialog>
      {outcome && <OutcomeDialog {...outcome} onClose={() => { const done = outcome.tone === "success"; setOutcome(null); if (done) { onDeleted(); onClose(); } }} />}
    </>
  );
}
