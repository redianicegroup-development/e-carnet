"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet, apiPatch, apiPost } from "../infrastructure/api/client";

type Encounter = { id: string; facility_label: string; reason: string; observations: string; recorded_with_help?: string; status: "draft" | "closed"; closed_at: string | null; provenance: { label: string } };
type FormState = { reason: string; observations: string; recorded_with_help: string };
const EMPTY_FORM: FormState = { reason: "", observations: "", recorded_with_help: "" };

/* Trois questions. Aucun établissement à choisir : c'est le médecin qui lit ce brouillon grâce au QR du patient,
   puis le clôture en signant sa consultation. La personne qui aide (souvent un infirmier sans compte) remplit sur le téléphone du patient. */
const QUESTIONS = [
  { eyebrow: "Étape 1 sur 3", title: "Quel est le motif de la consultation ?", hint: "Quelques mots suffisent : ce qui amène le patient." },
  { eyebrow: "Étape 2 sur 3", title: "Quels symptômes, depuis quand ?", hint: "Symptômes, début, intensité, ce qui a déjà été tenté. Cette réponse est facultative." },
  { eyebrow: "Étape 3 sur 3", title: "Qui remplit avec le patient ?", hint: "Indiquez le rôle ou le prénom (infirmier, infirmière, proche), ou passez cette étape." },
];

function formFrom(item: Encounter | null): FormState {
  return item ? { reason: item.reason, observations: item.observations, recorded_with_help: item.recorded_with_help ?? "" } : EMPTY_FORM;
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
    setBusy(true);
    setMessage("");
    try {
      const payload = { reason: form.reason.trim(), observations: form.observations.trim(), recorded_with_help: form.recorded_with_help.trim() };
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
        {step === 2 && <label className="field preconsult-wizard__field"><span>Personne qui aide (facultatif)</span><input autoFocus maxLength={120} value={form.recorded_with_help} onChange={(event) => setForm({ ...form, recorded_with_help: event.target.value })} placeholder="Ex. infirmière Awa, un proche" /></label>}
        <div className="preconsult-wizard__actions">
          {step > 0 && <button type="button" className="button preconsult-wizard__back" disabled={busy} onClick={() => { setStep((current) => current - 1); setMessage(""); }}>Retour</button>}
          {draft && step === 0 && <button type="button" className="button preconsult-wizard__back" disabled={busy} onClick={() => { setEditing(false); setMessage(""); }}>Annuler</button>}
          <button className="button primary preconsult-wizard__next" type="submit" disabled={busy}>{busy ? "Enregistrement…" : step === QUESTIONS.length - 1 ? "Enregistrer le brouillon" : "Continuer"}</button>
        </div>
        {(step === 1 || step === 2) && <button type="button" className="preconsult-wizard__skip" disabled={busy} onClick={skipOptionalStep}>{step === 2 ? "Enregistrer sans précision" : "Passer cette question"}</button>}
        <p className="status" role="status" aria-live="polite">{message}</p>
      </form>
    </section>}

    {draft && !editing && <section className="card preconsult-draft" aria-labelledby="preconsult-draft-title">
      <div className="section-heading"><div><span className="eyebrow">Brouillon en cours</span><h2 id="preconsult-draft-title">{draft.reason || "Sans motif"}</h2></div><span className="badge pending">Brouillon</span></div>
      {draft.observations && <p className="preconsult-draft__text">{draft.observations}</p>}
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
