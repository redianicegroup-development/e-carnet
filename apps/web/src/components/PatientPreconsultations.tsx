"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet, apiPatch, apiPost } from "../infrastructure/api/client";
import { describeVitals, emptyVitalsForm, parseVitalsForm, vitalsToForm, VITAL_FIELDS, type StoredVitals, type VitalKey, type VitalsForm } from "../lib/vitals";

type Encounter = { id: string; facility_label: string; reason: string; observations: string; vitals?: StoredVitals; recorded_with_help?: string; status: "draft" | "closed"; closed_at: string | null; provenance: { label: string } };
type FormState = { reason: string; observations: string; vitals: VitalsForm; recorded_with_help: string };
const EMPTY_FORM: FormState = { reason: "", observations: "", vitals: emptyVitalsForm(), recorded_with_help: "" };
const VITALS_STEP = 2;

/* Quatre questions (motif, symptômes, constantes, personne qui aide). Aucun établissement à choisir : c'est le médecin qui lit ce brouillon grâce au QR du patient,
   puis le clôture en signant sa consultation. La personne qui aide (souvent un infirmier sans compte) remplit sur le téléphone du patient. */
const QUESTIONS = [
  { eyebrow: "Étape 1 sur 4", title: "Quel est le motif de la consultation ?", hint: "Quelques mots suffisent. La pré-consultation se remplit dans l’espace patient, avec l’aide éventuelle d’un infirmier ou d’un proche, sans compte propre pour cette personne." },
  { eyebrow: "Étape 2 sur 4", title: "Quels symptômes, depuis quand ?", hint: "Symptômes, début, intensité, ce qui a déjà été tenté. Cette réponse est facultative." },
  { eyebrow: "Étape 3 sur 4", title: "Quelles constantes ont été relevées ?", hint: "Seulement ce qui a été mesuré : laissez vide le reste, rien n'est supposé. Tout est facultatif." },
  { eyebrow: "Étape 4 sur 4", title: "Qui remplit avec le patient ?", hint: "Indiquez le rôle ou le prénom (infirmier, infirmière, proche), ou passez cette étape." },
];

function formFrom(item: Encounter | null): FormState {
  return item ? { reason: item.reason, observations: item.observations, vitals: vitalsToForm(item.vitals), recorded_with_help: item.recorded_with_help ?? "" } : { ...EMPTY_FORM, vitals: emptyVitalsForm() };
}

export function PatientPreconsultations() {
  const [items, setItems] = useState<Encounter[] | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    apiGet<Encounter[]>("/api/v1/patient/care/encounters/")
      .then((encounters) => { if (active) setItems(encounters); })
      .catch((error) => { if (active) { setItems([]); setMessage(error instanceof Error ? error.message : "Impossible de charger les pré-consultations."); } });
    return () => { active = false; };
  }, []);

  const draft = (items ?? []).find((item) => item.status === "draft") ?? null;
  const closed = (items ?? []).filter((item) => item.status === "closed");
  const showWizard = items !== null && (!draft || editing);

  async function save() {
    // Les constantes sont revérifiées ici : « Passer » ou « Enregistrer » depuis une autre étape ne doit pas envoyer une valeur impossible.
    const parsedVitals = parseVitalsForm(form.vitals);
    if (!parsedVitals.ok) { setStep(VITALS_STEP); setMessage(parsedVitals.message); return; }
    setBusy(true);
    setMessage("");
    try {
      const payload = { reason: form.reason.trim(), observations: form.observations.trim(), vitals: parsedVitals.vitals, recorded_with_help: form.recorded_with_help.trim() };
      const saved = draft
        ? await apiPatch<Encounter>(`/api/v1/patient/care/encounters/${draft.id}/`, payload)
        : await apiPost<Encounter>("/api/v1/patient/care/encounters/", payload);
      setItems((current) => draft ? (current ?? []).map((item) => (item.id === saved.id ? saved : item)) : [saved, ...(current ?? [])]);
      setEditing(false);
      setStep(0);
      setMessage("Brouillon enregistré. Le médecin le lira en scannant votre QR, puis le clôturera à la fin de la consultation.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Enregistrement refusé."); }
    finally { setBusy(false); }
  }

  function advance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 0 && !form.reason.trim()) { setMessage("Indiquez le motif de la consultation pour continuer."); return; }
    if (step === VITALS_STEP) {
      const parsed = parseVitalsForm(form.vitals);
      if (!parsed.ok) { setMessage(parsed.message); return; }
    }
    setMessage("");
    if (step < QUESTIONS.length - 1) setStep((current) => current + 1);
    else void save();
  }

  function skipOptionalStep() {
    setMessage("");
    if (step < QUESTIONS.length - 1) setStep((current) => current + 1);
    else void save();
  }

  function startEditing() {
    setForm(formFrom(draft));
    setStep(0);
    setMessage("");
    setEditing(true);
  }

  const question = QUESTIONS[step];
  return <div className="stack-lg">
    {showWizard && <section className="card preconsult-wizard" aria-labelledby="preconsult-question" aria-describedby="preconsult-hint">
      <div className="preconsult-wizard__top"><span className="eyebrow">{draft ? "Modifier le brouillon" : "Préparer"} · {question.eyebrow}</span><span className="preconsult-wizard__counter">{step + 1}<span> / {QUESTIONS.length}</span></span></div>
      <div className="preconsult-wizard__progress" aria-hidden="true"><i style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }} /></div>
      <h2 id="preconsult-question" key={step}>{question.title}</h2>
      <p className="muted" id="preconsult-hint">{question.hint}</p>
      <form onSubmit={advance}>
        {step === 0 && <label className="field preconsult-wizard__field"><span>Motif</span><input autoFocus required maxLength={240} value={form.reason} onChange={(event) => { setForm({ ...form, reason: event.target.value }); setMessage(""); }} placeholder="Ex. fièvre depuis deux jours" /></label>}
        {step === 1 && <label className="field preconsult-wizard__field"><span>Symptômes ou observations</span><textarea autoFocus maxLength={2000} rows={5} value={form.observations} onChange={(event) => setForm({ ...form, observations: event.target.value })} placeholder="Depuis quand ? Qu’est-ce qui gêne ?" /></label>}
        {step === VITALS_STEP && <div className="vitals-grid" role="group" aria-label="Constantes relevées">{VITAL_FIELDS.map((field) => <label className="field" key={field.key}><span>{field.label} ({field.unit})</span><input inputMode="decimal" autoComplete="off" value={form.vitals[field.key]} onChange={(event) => { const value = event.target.value; setForm((current) => ({ ...current, vitals: { ...current.vitals, [field.key as VitalKey]: value } })); setMessage(""); }} placeholder={field.key === "systolic" ? "Ex. 120" : field.key === "diastolic" ? "Ex. 80" : undefined} /></label>)}<p className="muted vitals-grid__hint">Tension en mmHg : « 12/8 » sur un carnet papier correspond à 120 et 80.</p></div>}
        {step === 3 && <label className="field preconsult-wizard__field"><span>Personne qui aide (facultatif)</span><input autoFocus maxLength={120} value={form.recorded_with_help} onChange={(event) => setForm({ ...form, recorded_with_help: event.target.value })} placeholder="Ex. infirmière Awa, un proche" /></label>}
        <div className="preconsult-wizard__actions">
          {step > 0 && <button type="button" className="button preconsult-wizard__back" disabled={busy} onClick={() => { setStep((current) => current - 1); setMessage(""); }}>Retour</button>}
          {draft && step === 0 && <button type="button" className="button preconsult-wizard__back" disabled={busy} onClick={() => { setEditing(false); setMessage(""); }}>Annuler</button>}
          <button className="button primary preconsult-wizard__next" type="submit" disabled={busy}>{busy ? "Enregistrement…" : step === QUESTIONS.length - 1 ? "Enregistrer le brouillon" : "Continuer"}</button>
        </div>
        {step >= 1 && <button type="button" className="preconsult-wizard__skip" disabled={busy} onClick={skipOptionalStep}>{step === QUESTIONS.length - 1 ? "Enregistrer sans précision" : "Passer cette question"}</button>}
        <p className="status" role="status" aria-live="polite">{message}</p>
      </form>
    </section>}

    {draft && !editing && <section className="card preconsult-draft" aria-labelledby="preconsult-draft-title">
      <div className="section-heading"><div><span className="eyebrow">Brouillon en cours</span><h2 id="preconsult-draft-title">{draft.reason || "Sans motif"}</h2></div><span className="badge pending">Brouillon</span></div>
      {draft.observations && <p className="preconsult-draft__text">{draft.observations}</p>}
      {describeVitals(draft.vitals).length > 0 && <p className="preconsult-draft__vitals"><strong>Constantes :</strong> {describeVitals(draft.vitals).map((line) => `${line.label} ${line.text}`).join(" · ")}</p>}
      {draft.recorded_with_help && <p className="muted">Rempli avec l’aide de : {draft.recorded_with_help}</p>}
      <p className="muted">Pour que le médecin le lise, ouvrez votre QR d’accès : il le verra, travaillera dessus, puis clôturera la pré-consultation en signant sa consultation. Vous pouvez encore la modifier d’ici là.</p>
      <div className="actions"><button type="button" className="button" onClick={startEditing}>Modifier le brouillon</button><Link className="button primary" href="/patient/acces">Ouvrir mon QR d’accès</Link></div>
      <p className="status" role="status" aria-live="polite">{message}</p>
    </section>}

    <section className="card" aria-label="Pré-consultations clôturées">
      <div className="section-heading"><div><span className="eyebrow">Clôturées par un médecin</span><h2>Mes pré-consultations</h2></div><span className="count-badge">{items ? closed.length : "…"}</span></div>
      {items === null ? <div className="skeleton" role="status"><span className="sr-only">Chargement…</span><i /></div> : closed.length === 0 ? <p className="empty">Aucune pré-consultation clôturée pour le moment. Le médecin la clôture lorsqu’il signe votre consultation.</p> : <div className="stack">{closed.map((item) => <article className="record" key={item.id}><div><strong>{item.reason}</strong><p className="muted">{item.facility_label || "Établissement du médecin"}{item.closed_at ? ` · clôturée le ${new Date(item.closed_at).toLocaleDateString("fr-FR")}` : ""}</p></div><span className="badge measured">Clôturée</span></article>)}</div>}
    </section>
  </div>;
}
