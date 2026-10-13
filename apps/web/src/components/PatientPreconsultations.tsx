"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../infrastructure/api/client";

type Encounter = { id: string; establishment_id: string | null; facility_label: string; reason: string; observations: string; recorded_with_help?: string; status: "draft" | "closed"; closed_at: string | null; provenance: { label: string } };
type EstablishmentOption = { id: string; name: string; city: string };
type FormState = { establishment_id: string; reason: string; observations: string; recorded_with_help: string };
const EMPTY_FORM: FormState = { establishment_id: "", reason: "", observations: "", recorded_with_help: "" };
const QUESTIONS = [
  { eyebrow: "Étape 1 sur 4", title: "Où souhaitez-vous consulter ?", hint: "Le lieu est repris du registre de l’établissement." },
  { eyebrow: "Étape 2 sur 4", title: "Quel est le motif de votre consultation ?", hint: "Décrivez en quelques mots ce qui vous amène." },
  { eyebrow: "Étape 3 sur 4", title: "Que ressentez-vous ?", hint: "Vous pouvez préciser les symptômes et depuis quand. Cette réponse est facultative." },
  { eyebrow: "Étape 4 sur 4", title: "Quelqu’un vous aide à remplir ?", hint: "Vous pouvez indiquer son rôle ou son prénom, ou passer cette étape." },
];

export function PatientPreconsultations() {
  const [items, setItems] = useState<Encounter[] | null>(null);
  const [establishments, setEstablishments] = useState<EstablishmentOption[] | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([apiGet<Encounter[]>("/api/v1/patient/care/encounters/"), apiGet<EstablishmentOption[]>("/api/v1/establishments/catalog/")])
      .then(([encounters, sites]) => { if (active) { setItems(encounters); setEstablishments(sites); setMessage(sites.length ? "Répondez à une question à la fois." : "Aucun établissement actif n’est disponible pour le moment."); } })
      .catch((error) => { if (active) { setItems([]); setEstablishments([]); setMessage(error instanceof Error ? error.message : "Impossible de charger les établissements et pré-consultations."); } });
    return () => { active = false; };
  }, []);

  async function create() {
    setBusy(true);
    setMessage("");
    try {
      const created = await apiPost<Encounter>("/api/v1/patient/care/encounters/", form);
      setItems((current) => [created, ...(current ?? [])]);
      setForm(EMPTY_FORM);
      setStep(0);
      setMessage("Pré-consultation enregistrée. Seul un professionnel rattaché à cet établissement pourra la lire, avec votre autorisation.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Pré-consultation refusée."); }
    finally { setBusy(false); }
  }

  function advance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 0 && !form.establishment_id) { setMessage("Choisissez un établissement pour continuer."); return; }
    if (step === 1 && !form.reason.trim()) { setMessage("Indiquez le motif de votre consultation pour continuer."); return; }
    setMessage("");
    if (step < QUESTIONS.length - 1) setStep((current) => current + 1);
    else void create();
  }

  function skipOptionalStep() {
    setMessage("");
    if (step < QUESTIONS.length - 1) setStep((current) => current + 1);
    else void create();
  }

  async function close(id: string) {
    setMessage("");
    try {
      const closed = await apiPost<Encounter>(`/api/v1/patient/care/encounters/${id}/`, {});
      setItems((current) => (current ?? []).map((item) => (item.id === id ? closed : item)));
      setMessage("Pré-consultation clôturée. Elle n’est lisible qu’avec votre autorisation et par le même établissement.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Clôture impossible."); }
  }

  const question = QUESTIONS[step];
  return <div className="stack-lg">
    <section className="card preconsult-wizard" aria-labelledby="preconsult-question" aria-describedby="preconsult-hint">
      <div className="preconsult-wizard__top"><span className="eyebrow">Préparer · {question.eyebrow}</span><span className="preconsult-wizard__counter">{step + 1}<span> / {QUESTIONS.length}</span></span></div>
      <div className="preconsult-wizard__progress" aria-hidden="true"><i style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }} /></div>
      <h2 id="preconsult-question" key={step}>{question.title}</h2>
      <p className="muted" id="preconsult-hint">{question.hint}</p>
      <form onSubmit={advance}>
        {step === 0 && <label className="field preconsult-wizard__field"><span>Établissement destinataire</span><select autoFocus required value={form.establishment_id} onChange={(event) => { setForm({ ...form, establishment_id: event.target.value }); setMessage(""); }} disabled={!establishments?.length || busy}><option value="">Choisir un établissement actif</option>{(establishments ?? []).map((site) => <option key={site.id} value={site.id}>{site.name} — {site.city}</option>)}</select></label>}
        {step === 1 && <label className="field preconsult-wizard__field"><span>Motif</span><input autoFocus required maxLength={240} value={form.reason} onChange={(event) => { setForm({ ...form, reason: event.target.value }); setMessage(""); }} placeholder="Ex. fièvre depuis deux jours" /></label>}
        {step === 2 && <label className="field preconsult-wizard__field"><span>Vos symptômes ou observations</span><textarea autoFocus maxLength={2000} rows={5} value={form.observations} onChange={(event) => setForm({ ...form, observations: event.target.value })} placeholder="Depuis quand ? Qu’est-ce qui vous gêne ?" /></label>}
        {step === 3 && <label className="field preconsult-wizard__field"><span>Personne qui vous aide (facultatif)</span><input autoFocus maxLength={120} value={form.recorded_with_help} onChange={(event) => setForm({ ...form, recorded_with_help: event.target.value })} placeholder="Ex. un proche ou une infirmière" /></label>}
        <div className="preconsult-wizard__actions">
          {step > 0 && <button type="button" className="button preconsult-wizard__back" disabled={busy} onClick={() => { setStep((current) => current - 1); setMessage(""); }}>Retour</button>}
          <button className="button primary preconsult-wizard__next" type="submit" disabled={busy || (step === 0 && !establishments?.length)}>{busy ? "Enregistrement…" : step === QUESTIONS.length - 1 ? "Enregistrer en brouillon" : "Continuer"}</button>
        </div>
        {(step === 2 || step === 3) && <button type="button" className="preconsult-wizard__skip" disabled={busy} onClick={skipOptionalStep}>{step === 3 ? "Enregistrer sans précision" : "Passer cette question"}</button>}
        <p className="status" role="status" aria-live="polite">{message}</p>
      </form>
    </section>

    <section className="card" aria-label="Mes pré-consultations">
      <div className="section-heading"><div><span className="eyebrow">Brouillons et clôturées</span><h2>Mes pré-consultations</h2></div><span className="count-badge">{items?.length ?? "…"}</span></div>
      {items === null ? <div className="skeleton" role="status"><span className="sr-only">Chargement…</span><i /></div> : items.length === 0 ? <p className="empty">Aucune pré-consultation. Préparez-en une avant votre prochain rendez-vous.</p> : <div className="stack">{items.map((item) => <article className="record" key={item.id}><div><strong>{item.reason}</strong><p className="muted">{item.facility_label || "Aucun établissement associé"}{item.closed_at ? ` · clôturée le ${new Date(item.closed_at).toLocaleDateString("fr-FR")}` : ""}</p>{item.status === "draft" && <button type="button" className="button small" onClick={() => void close(item.id)}>Clôturer</button>}</div><span className={item.status === "draft" ? "badge pending" : "badge measured"}>{item.status === "draft" ? "Brouillon" : item.provenance.label}</span></article>)}</div>}
    </section>
  </div>;
}
