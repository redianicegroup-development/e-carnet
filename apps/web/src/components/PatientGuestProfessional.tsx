"use client";

import { useState } from "react";
import { ApiError } from "../infrastructure/api/client";
import { lookupGuestProfessional, saveGuestConsultation, startGuestProfessional, type GuestProfessionalLookup, type GuestSession } from "../application/guest-access";
import { SYMPTOM_PICTOGRAMS } from "../lib/pictograms";
import { CARE_PLAN_ITEMS, CLINICAL_FINDINGS, CONCLUSION_ITEMS, DIAGNOSES, buildPicked } from "../lib/consultation-options";
import { buildObservations, OBSERVATIONS_MAX, OTHER_MAX, SYMPTOMS, type SymptomsForm } from "../lib/preconsult";
import { emptyVitalsForm, parseVitalsForm, type VitalsForm } from "../lib/vitals";
import { checkPrescriptionLines } from "../lib/prescription-check";
import { ChipPicker, FormSection, VitalsPicker } from "./consultation/ConsultationParts";
import { PrescriptionPicker, type LineDraft } from "./consultation/OrderPickers";
import { PersonAvatar } from "./ui/PersonAvatar";
import "./guest-access.css";

/* Mode invité côté patient : le médecin n'a pas son téléphone, il écrit la consultation sur celui du patient.
   1) il saisit SON nom, sa date de naissance et son téléphone → son profil s'affiche ;
   2) le patient le compare au médecin devant lui et confirme (ces informations identifient, elles ne prouvent rien) ;
   3) le médecin écrit la consultation (2 h maximum) ; elle est enregistrée SANS signature, « en attente de confirmation » ;
   4) plus tard, sur son propre téléphone, il la relit, la corrige au besoin et la signe : c'est alors seulement qu'elle entre dans le carnet. */

type Step = "search" | "compare" | "write" | "done";
type PickState = { selected: string[]; other: string };
const EMPTY_PICK: PickState = { selected: [], other: "" };
const EMPTY_FORM = { first_name: "", last_name: "", birth_date: "", phone: "" };
const TIME = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

export function PatientGuestProfessional({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState<Step>("search");
  const [form, setForm] = useState(EMPTY_FORM);
  const [found, setFound] = useState<GuestProfessionalLookup | null>(null);
  const [session, setSession] = useState<GuestSession | null>(null);
  const [reason, setReason] = useState("");
  const [symptoms, setSymptoms] = useState<SymptomsForm>({ selected: [], other: "" });
  const [vitalsForm, setVitalsForm] = useState<VitalsForm>(emptyVitalsForm());
  const [clinical, setClinical] = useState<PickState>(EMPTY_PICK);
  const [diagnosis, setDiagnosis] = useState<PickState>(EMPTY_PICK);
  const [carePlan, setCarePlan] = useState<PickState>(EMPTY_PICK);
  const [conclusion, setConclusion] = useState<PickState>(EMPTY_PICK);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const patchForm = (patch: Partial<typeof EMPTY_FORM>) => setForm((current) => ({ ...current, ...patch }));
  const complete = Object.values(form).every((value) => value.trim());
  const doctorName = found ? `${found.professional.title ? `${found.professional.title} ` : ""}${found.professional.first_name} ${found.professional.last_name}`.trim() : "";
  const symptomsTooLong = buildObservations(symptoms).length > OBSERVATIONS_MAX;

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (!complete || busy) return;
    setBusy(true); setError("");
    try {
      setFound(await lookupGuestProfessional({ first_name: form.first_name.trim(), last_name: form.last_name.trim(), birth_date: form.birth_date, phone: form.phone.trim() }));
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
      setSession(await startGuestProfessional(found.confirmation_token));
      setStep("write");
    } catch (failure) {
      setFound(null); setStep("search");
      setError(failure instanceof ApiError ? failure.message : "Ouverture de la session impossible. Refaites la recherche.");
    } finally {
      setBusy(false);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!session || busy) return;
    if (!reason.trim()) { setError("Indiquez le motif de la consultation."); return; }
    const vitals = parseVitalsForm(vitalsForm);
    if (!vitals.ok) { setError(vitals.message); return; }
    const orders = checkPrescriptionLines(lines);
    if (!orders.ok) { setError(orders.message); return; }
    setBusy(true); setError("");
    try {
      await saveGuestConsultation(session.grant_id, {
        reason: reason.trim(),
        symptoms: buildObservations(symptoms),
        clinical_exam: buildPicked(clinical.selected, CLINICAL_FINDINGS, clinical.other),
        diagnosis: buildPicked(diagnosis.selected, DIAGNOSES, diagnosis.other),
        vitals: vitals.vitals,
        prescription_lines: orders.lines,
        conclusion: buildPicked(conclusion.selected, CONCLUSION_ITEMS, conclusion.other),
        care_plan: buildPicked(carePlan.selected, CARE_PLAN_ITEMS, carePlan.other),
      });
      setStep("done");
      onSaved();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : "Enregistrement impossible. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card guest-access" aria-labelledby="guest-pro-title">
      <div className="guest-access__head">
        <h3 id="guest-pro-title">Mode invité</h3>
        <button type="button" className="button small" onClick={onClose}>Fermer</button>
      </div>

      {step === "search" && (
        <form className="guest-access" onSubmit={search} noValidate>
          <p className="muted">Votre médecin n’a pas son téléphone ? Il peut écrire la consultation ici. Elle restera « en attente » jusqu’à ce qu’il la confirme depuis son propre téléphone.</p>
          <div className="guest-access__fields">
            <label className="field"><span>Prénom du médecin</span><input value={form.first_name} maxLength={80} autoComplete="off" onChange={(event) => patchForm({ first_name: event.target.value })} /></label>
            <label className="field"><span>Nom du médecin</span><input value={form.last_name} maxLength={80} autoComplete="off" onChange={(event) => patchForm({ last_name: event.target.value })} /></label>
            <label className="field"><span>Date de naissance du médecin</span><input type="date" value={form.birth_date} autoComplete="off" onChange={(event) => patchForm({ birth_date: event.target.value })} /></label>
            <label className="field"><span>Téléphone du médecin</span><input type="tel" inputMode="tel" value={form.phone} maxLength={32} autoComplete="off" onChange={(event) => patchForm({ phone: event.target.value })} /></label>
          </div>
          <button className="button primary" type="submit" disabled={!complete || busy}>{busy ? "Recherche…" : "Rechercher"}</button>
        </form>
      )}

      {step === "compare" && found && (
        <div className="guest-access">
          <p className="muted">Est-ce bien le médecin qui se trouve devant vous ?</p>
          <div className="guest-access__compare">
            <PersonAvatar src={found.professional.photo_url} name={doctorName} size={72} />
            <div><strong>{doctorName}</strong><small className="muted">{found.professional.establishment_name}</small>{!found.professional.photo_url && <small className="muted">Aucune photo enregistrée : demandez-lui une pièce d’identité.</small>}</div>
          </div>
          <div className="guest-access__actions">
            <button className="button primary" type="button" disabled={busy} onClick={() => void confirm()}>{busy ? "Ouverture…" : "C’est bien ce médecin"}</button>
            <button className="button" type="button" disabled={busy} onClick={() => { setFound(null); setStep("search"); setError(""); }}>Ce n’est pas lui</button>
          </div>
          <p className="muted">Il pourra écrire la consultation pendant 2 h. Elle ne sera pas signée tant qu’il ne l’aura pas confirmée.</p>
        </div>
      )}

      {step === "write" && session && (
        <form className="guest-access preconsult-form" onSubmit={save} noValidate>
          <p className="notice" role="status">Consultation écrite par {session.professional_name}. Session ouverte jusqu’à {TIME.format(new Date(session.expires_at))}.</p>
          <FormSection num={1} title="Quel est le motif de la consultation ?"><label className="field"><span>Motif</span><input maxLength={240} value={reason} onChange={(event) => setReason(event.target.value)} /></label></FormSection>
          <FormSection num={2} title="Quels symptômes ou maux le patient ressent-il ?" hint="Cochez ce qui correspond (facultatif).">
            <ChipPicker label="Symptômes les plus fréquents" options={SYMPTOMS} pictograms={SYMPTOM_PICTOGRAMS} selected={symptoms.selected} other={symptoms.other} onSelected={(selected) => setSymptoms({ ...symptoms, selected })} onOther={(other) => setSymptoms({ ...symptoms, other })} otherLabel="Autre symptôme, depuis quand, intensité (facultatif)" otherPlaceholder="Si le symptôme n’est pas dans la liste, écrivez-le ici." maxOther={OTHER_MAX} rows={3} />
            {symptomsTooLong && <p className="status" role="alert">Le texte est trop long : raccourcissez-le.</p>}
          </FormSection>
          <FormSection num={3} title="Quelles constantes ont été relevées ?"><VitalsPicker value={vitalsForm} onChange={setVitalsForm} /></FormSection>
          <FormSection num={4} title="Examen clinique" hint="Cochez les constats de l’examen (facultatif)."><ChipPicker label="Constats de l’examen clinique" options={CLINICAL_FINDINGS} selected={clinical.selected} other={clinical.other} onSelected={(selected) => setClinical({ ...clinical, selected })} onOther={(other) => setClinical({ ...clinical, other })} otherLabel="Autre constat (facultatif)" /></FormSection>
          <FormSection num={5} title="Diagnostic"><ChipPicker label="Diagnostics les plus fréquents" options={DIAGNOSES} selected={diagnosis.selected} other={diagnosis.other} onSelected={(selected) => setDiagnosis({ ...diagnosis, selected })} onOther={(other) => setDiagnosis({ ...diagnosis, other })} otherLabel="Autre diagnostic (facultatif)" /></FormSection>
          <FormSection num={6} title="Conduite à tenir"><ChipPicker label="Conduite à tenir" options={CARE_PLAN_ITEMS} selected={carePlan.selected} other={carePlan.other} onSelected={(selected) => setCarePlan({ ...carePlan, selected })} onOther={(other) => setCarePlan({ ...carePlan, other })} otherLabel="Autre consigne (facultatif)" /></FormSection>
          <FormSection num={7} title="Conclusion"><ChipPicker label="Conclusion" options={CONCLUSION_ITEMS} selected={conclusion.selected} other={conclusion.other} onSelected={(selected) => setConclusion({ ...conclusion, selected })} onOther={(other) => setConclusion({ ...conclusion, other })} otherLabel="Autre conclusion (facultatif)" /></FormSection>
          <FormSection num={8} title="Ordonnance" hint="Choisissez dans les listes ; « Autre » pour ce qui n’y figure pas."><PrescriptionPicker lines={lines} onChange={setLines} /></FormSection>
          <p className="muted">Rien n’est signé ici. Le médecin relira, corrigera au besoin et signera depuis son propre téléphone.</p>
          <button className="button primary" type="submit" disabled={busy || !reason.trim()}>{busy ? "Enregistrement…" : "Enregistrer en attente de confirmation"}</button>
        </form>
      )}

      {step === "done" && session && (
        <div className="guest-access">
          <p className="notice" role="status">Consultation enregistrée, en attente de confirmation.</p>
          <p className="muted">{session.professional_name} doit la relire et la signer depuis son téléphone. Vous la verrez dans votre carnet dès qu’il l’aura confirmée. Cette session est fermée : ce téléphone n’a plus d’accès médecin.</p>
          <button className="button primary" type="button" onClick={onClose}>Terminer</button>
        </div>
      )}

      {error && <p className="status" role="alert">{error}</p>}
    </section>
  );
}
