"use client";

import { useState, type FormEvent } from "react";
import { apiPost } from "../infrastructure/api/client";
import { errorReason } from "../lib/access-outcome";
import { ageLabel } from "../lib/age";
import { profileName, runAsProfile, type PatientProfileEntry } from "../lib/patient-profiles";
import { AvatarPicker } from "./AvatarPicker";
import { OutcomeDialog, type OutcomeDialogProps } from "./modal/OutcomeDialog";
import { PanelDialog } from "./modal/PanelDialog";
import { EMPTY_PATIENT_FORM, PatientIdentityFields, onboardingErrorMessage, patientFormProblem, saveChildIdentity, type PatientForm } from "./PatientIdentityFields";
import "./patient-profiles.css";

/* Onboarding d'un enfant (Paramètres > Carnet enfant > Ajouter un carnet enfant) : le même parcours que l'onboarding patient (couverture du carnet : ville, adresse,
   téléphone, genre, couverture), précédé de ce qui est propre à l'enfant : SA PHOTO, son prénom, son nom et sa DATE DE NAISSANCE.
   Un seul envoi : 1) création du profil (avec la photo) 2) enregistrement du carnet, sans changer le profil ouvert (runAsProfile).
   Le résultat s'affiche toujours dans un modal : succès (le carnet de l'enfant est ouvert) ou échec avec son motif. Si seul le carnet échoue, le profil
   est déjà créé : « Réessayer » ne renvoie que le carnet (aucun doublon). */

const CREATE_ERROR_FALLBACK = "Le profil n’a pas pu être créé. Vérifiez les informations saisies et réessayez.";

export function ChildOnboarding({ onClose, onCreated }: { onClose: () => void; onCreated: (child: PatientProfileEntry) => void }) {
  const [form, setForm] = useState<PatientForm>(EMPTY_PATIENT_FORM);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [photo, setPhoto] = useState("");
  const [legalRepresentativeConfirmed, setLegalRepresentativeConfirmed] = useState(false);
  const [created, setCreated] = useState<PatientProfileEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [outcome, setOutcome] = useState<Omit<OutcomeDialogProps, "onClose"> | null>(null);
  const update = (field: keyof PatientForm, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const initials = `${firstName.trim()[0] ?? ""}${lastName.trim()[0] ?? ""}`.toUpperCase() || "+";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = !created && (!firstName.trim() || !lastName.trim()) ? "Saisissez le prénom et le nom de l’enfant." : patientFormProblem(form);
    if (problem) { setMessage(problem); return; }
    setBusy(true);
    setMessage("");
    let child = created;
    if (!child) {
      try {
        child = await apiPost<PatientProfileEntry>("/api/v1/patient/representations/", {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          birth_date: form.birth_date,
          relationship: "child",
          legal_representative_confirmed: legalRepresentativeConfirmed,
          ...(photo ? { avatar_data: photo } : {}),
        });
        setCreated(child);
        onCreated(child); // la liste des profils se recharge tout de suite, même si le carnet échoue ensuite
      } catch (error) {
        const reason = errorReason(error, CREATE_ERROR_FALLBACK);
        setMessage(reason);
        setOutcome({ tone: "error", title: "Profil non créé", message: reason });
        setBusy(false);
        return;
      }
    }
    try {
      await runAsProfile(child.patient_id, () => saveChildIdentity(form));
      setOutcome({ tone: "success", title: "Profil créé", message: `Le carnet de ${profileName(child)} est ouvert. Son dossier est distinct du vôtre.`, note: "Pour le consulter, changez de profil avec la flèche de la carte « Compte patient ». Chacun de vos accès à ce dossier est journalisé." });
    } catch (error) {
      const reason = onboardingErrorMessage(error);
      setMessage(reason);
      setOutcome({ tone: "error", title: "Carnet non enregistré", message: `Le profil de ${profileName(child)} est créé, mais son carnet n’a pas pu être enregistré : ${reason}`, note: "Appuyez sur « Réessayer » : seul le carnet sera renvoyé, le profil ne sera pas créé une seconde fois." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PanelDialog title="Ajouter un carnet enfant" lead="Même parcours que votre propre carnet, pour votre enfant : sa photo, sa date de naissance, sa ville et un téléphone sont demandés. Le reste pourra être ajouté plus tard." onClose={onClose}>
        <form className="settings-form child-onboarding" onSubmit={(event) => void submit(event)}>
          <p className="notice" role="note">Utilisez des informations exactes. Le dossier de l’enfant est distinct du vôtre.</p>
          <h3>L’enfant</h3>
          <div className="child-onboarding__photo"><AvatarPicker value={photo} onChange={setPhoto} fallback={initials} disabled={busy || Boolean(created)} /><span className="muted">Photo de l’enfant (facultative)</span></div>
          <div className="auth-name-grid">
            <label className="field"><span>Prénom</span><input required maxLength={80} autoComplete="off" value={firstName} onChange={(event) => setFirstName(event.target.value)} disabled={busy || Boolean(created)} /></label>
            <label className="field"><span>Nom</span><input required maxLength={80} autoComplete="off" value={lastName} onChange={(event) => setLastName(event.target.value)} disabled={busy || Boolean(created)} /></label>
          </div>
          <label className="field"><span>Date de naissance</span><input required type="date" max={new Date().toISOString().slice(0, 10)} value={form.birth_date} onChange={(event) => update("birth_date", event.target.value)} disabled={busy || Boolean(created)} /></label>
          <p className="onboarding-age-gender__age" role="status" aria-live="polite"><span>Âge</span><strong>{ageLabel(form.birth_date) || "calculé à partir de la date de naissance"}</strong></p>
          <label className="check"><input required type="checkbox" checked={legalRepresentativeConfirmed || Boolean(created)} onChange={(event) => setLegalRepresentativeConfirmed(event.target.checked)} disabled={busy || Boolean(created)} /> <span>Je confirme être autorisé(e) à représenter légalement cet enfant.</span></label>
          <h3>Son carnet</h3>
          <PatientIdentityFields form={form} update={update} issuedAt={new Date()} showProfession={false} showBirthDate={false} />
          <div className="child-onboarding__actions">
            <button className="button primary" type="submit" disabled={busy}>{busy ? "Enregistrement…" : created ? "Réessayer l’enregistrement du carnet" : "Créer le carnet"}</button>
            <button className="button" type="button" disabled={busy} onClick={onClose}>{created ? "Plus tard" : "Annuler"}</button>
          </div>
          <p className="status" role="status" aria-live="polite">{message}</p>
        </form>
      </PanelDialog>
      {outcome && <OutcomeDialog {...outcome} onClose={() => { const done = outcome.tone === "success"; setOutcome(null); if (done) onClose(); }} />}
    </>
  );
}
