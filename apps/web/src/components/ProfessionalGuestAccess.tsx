"use client";

import { useState } from "react";
import { ApiError } from "../infrastructure/api/client";
import { createGuestPreconsultation, lookupGuestPatient, startGuestAccess, type GuestLookupResult } from "../application/guest-access";
import type { ProfessionalGrant } from "../application/professional-access-grants";
import { PersonAvatar } from "./ui/PersonAvatar";
import "./guest-access.css";

/* Mode invité du professionnel : le patient n'a pas son téléphone.
   1) nom + date de naissance + téléphone → un seul profil (nom, photo) ;
   2) le professionnel le compare à la personne présente et confirme (ces trois informations identifient, elles ne prouvent rien) ;
   3) accès de 2 h limité à la pré-consultation : le médecin la crée, puis la consultation continue comme d'habitude, signée par lui. */

type Step = "search" | "compare" | "motif";
const EMPTY_FORM = { first_name: "", last_name: "", birth_date: "", phone: "" };

export function ProfessionalGuestAccess({ onReady }: { onReady: (grant: ProfessionalGrant) => void | Promise<void> }) {
  const [step, setStep] = useState<Step>("search");
  const [form, setForm] = useState(EMPTY_FORM);
  const [found, setFound] = useState<GuestLookupResult | null>(null);
  const [grant, setGrant] = useState<ProfessionalGrant | null>(null);
  const [reason, setReason] = useState("");
  const [observations, setObservations] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const patchForm = (patch: Partial<typeof EMPTY_FORM>) => setForm((current) => ({ ...current, ...patch }));
  const complete = Object.values(form).every((value) => value.trim());

  function restart(info = "") {
    setStep("search"); setFound(null); setGrant(null); setReason(""); setObservations(""); setError(""); setMessage(info);
    if (info) return; // après une annulation, on garde la saisie pour corriger ; après une consultation lancée, on repart à blanc.
    setForm(EMPTY_FORM);
  }

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (!complete || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      setFound(await lookupGuestPatient({ first_name: form.first_name.trim(), last_name: form.last_name.trim(), birth_date: form.birth_date, phone: form.phone.trim() }));
      setStep("compare");
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : "Recherche impossible. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!found || busy) return;
    setBusy(true); setError("");
    try {
      setGrant(await startGuestAccess(found.confirmation_token));
      setStep("motif");
    } catch (failure) {
      // Jeton expiré, déjà utilisé ou autre professionnel connecté : on repart de la recherche avec le message du serveur.
      setFound(null); setStep("search");
      setError(failure instanceof ApiError ? failure.message : "Ouverture de l’accès impossible. Refaites la recherche.");
    } finally {
      setBusy(false);
    }
  }

  async function begin(event: React.FormEvent) {
    event.preventDefault();
    if (!grant || !reason.trim() || busy) return;
    setBusy(true); setError("");
    try {
      await createGuestPreconsultation(grant.id, { reason: reason.trim(), observations: observations.trim() });
      await onReady(grant);
      restart();
      setMessage("Consultation prête : le formulaire « Terminer la consultation » est ouvert plus haut.");
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : "Impossible de préparer la consultation.");
    } finally {
      setBusy(false);
    }
  }

  const fullName = found ? `${found.patient.first_name} ${found.patient.last_name}`.trim() : "";

  return (
    <div className="guest-access">
      {step === "search" && (
        <form className="guest-access" onSubmit={search} noValidate>
          <p className="muted">Le patient n’a pas son téléphone ? Retrouvez son dossier avec son nom, sa date de naissance et son numéro de téléphone.</p>
          <div className="guest-access__fields">
            <label className="field"><span>Prénom</span><input value={form.first_name} maxLength={80} autoComplete="off" onChange={(event) => patchForm({ first_name: event.target.value })} /></label>
            <label className="field"><span>Nom</span><input value={form.last_name} maxLength={80} autoComplete="off" onChange={(event) => patchForm({ last_name: event.target.value })} /></label>
            <label className="field"><span>Date de naissance</span><input type="date" value={form.birth_date} autoComplete="off" onChange={(event) => patchForm({ birth_date: event.target.value })} /></label>
            <label className="field"><span>Téléphone</span><input type="tel" inputMode="tel" value={form.phone} maxLength={32} autoComplete="off" onChange={(event) => patchForm({ phone: event.target.value })} /></label>
          </div>
          <button className="button primary" type="submit" disabled={!complete || busy}>{busy ? "Recherche…" : "Rechercher"}</button>
        </form>
      )}

      {step === "compare" && found && (
        <div className="guest-access">
          <p className="muted">Comparez ce profil avec la personne qui se trouve devant vous.</p>
          <div className="guest-access__compare">
            <PersonAvatar src={found.patient.photo_url} name={fullName} size={72} />
            <div><strong>{fullName}</strong>{!found.patient.photo_url && <small className="muted">Aucune photo enregistrée : vérifiez une pièce d’identité.</small>}</div>
          </div>
          <div className="guest-access__actions">
            <button className="button primary" type="button" disabled={busy} onClick={() => void confirm()}>{busy ? "Ouverture…" : "C’est bien cette personne"}</button>
            <button className="button" type="button" disabled={busy} onClick={() => restart("Recherche annulée. Corrigez les informations si besoin.")}>Ce n’est pas elle</button>
          </div>
          <p className="muted">L’accès dure 2 h et ne couvre que la pré-consultation. Le patient en sera averti.</p>
        </div>
      )}

      {step === "motif" && grant && (
        <form className="guest-access" onSubmit={begin} noValidate>
          <p className="notice" role="status">Accès invité ouvert pour {fullName || "ce patient"}, pendant 2 h.</p>
          <label className="field"><span>Motif de la consultation</span><input value={reason} maxLength={240} placeholder="Ex. fièvre depuis deux jours" onChange={(event) => setReason(event.target.value)} /></label>
          <label className="field"><span>Observations (facultatif)</span><textarea value={observations} maxLength={4000} rows={3} onChange={(event) => setObservations(event.target.value)} /></label>
          <button className="button primary" type="submit" disabled={!reason.trim() || busy}>{busy ? "Préparation…" : "Commencer la consultation"}</button>
        </form>
      )}

      {error && <p className="status" role="alert">{error}</p>}
      {message && !error && <p className="muted" role="status" aria-live="polite">{message}</p>}
    </div>
  );
}
