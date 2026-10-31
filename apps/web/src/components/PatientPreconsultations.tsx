"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet, apiPatch, apiPost } from "../infrastructure/api/client";
import { describeVitals, emptyVitalsForm, parseVitalsForm, vitalsToForm, VITAL_FIELDS, type StoredVitals, type VitalsForm } from "../lib/vitals";
import { buildObservations, isListed, numberOptions, OBSERVATIONS_MAX, OTHER_MAX, parseObservations, SYMPTOMS } from "../lib/preconsult";
import "./preconsult-form.css";

type Encounter = { id: string; facility_label: string; reason: string; observations: string; vitals?: StoredVitals; recorded_with_help?: string; status: "draft" | "closed"; closed_at: string | null; provenance: { label: string } };
type FormState = { reason: string; selected: string[]; other: string; vitals: VitalsForm; recorded_with_help: string };
const EMPTY_FORM: FormState = { reason: "", selected: [], other: "", vitals: emptyVitalsForm(), recorded_with_help: "" };

/* Un seul bloc, quatre sections (motif, symptômes, constantes, personne qui aide) : plus d'étapes à enchaîner.
   Aucun établissement à choisir : c'est le médecin qui lit ce brouillon grâce au QR du patient, puis le clôture en signant sa consultation.
   La personne qui aide (souvent un infirmier sans compte) remplit sur le téléphone du patient. */
function formFrom(item: Encounter | null): FormState {
  if (!item) return { ...EMPTY_FORM, selected: [], vitals: emptyVitalsForm() };
  const symptoms = parseObservations(item.observations);
  return { reason: item.reason, selected: symptoms.selected, other: symptoms.other, vitals: vitalsToForm(item.vitals), recorded_with_help: item.recorded_with_help ?? "" };
}

export function PatientPreconsultations({ onDraftChange }: { onDraftChange?: (hasDraft: boolean) => void }) {
  const [items, setItems] = useState<Encounter[] | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editing, setEditing] = useState(false);
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
  const hasDraft = Boolean(draft);
  // La pré-consultation est « faite » dès qu'un brouillon est enregistré : l'écran des consultations en tire l'étape 2 (accès temporaire).
  useEffect(() => { if (items !== null) onDraftChange?.(hasDraft); }, [items, hasDraft, onDraftChange]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!form.reason.trim()) { setMessage("Indiquez le motif de la consultation pour continuer."); document.getElementById("preconsult-reason")?.focus(); return; }
    // Les constantes sont vérifiées ici : une valeur impossible n'est jamais envoyée.
    const parsedVitals = parseVitalsForm(form.vitals);
    if (!parsedVitals.ok) { setMessage(parsedVitals.message); return; }
    setBusy(true);
    setMessage("");
    try {
      const payload = { reason: form.reason.trim(), observations: buildObservations({ selected: form.selected, other: form.other }), vitals: parsedVitals.vitals, recorded_with_help: form.recorded_with_help.trim() };
      const saved = draft
        ? await apiPatch<Encounter>(`/api/v1/patient/care/encounters/${draft.id}/`, payload)
        : await apiPost<Encounter>("/api/v1/patient/care/encounters/", payload);
      setItems((current) => draft ? (current ?? []).map((item) => (item.id === saved.id ? saved : item)) : [saved, ...(current ?? [])]);
      setEditing(false);
      setForm({ ...EMPTY_FORM, selected: [], vitals: emptyVitalsForm() });
      setMessage("Brouillon enregistré. Le médecin le lira en scannant votre QR, puis le clôturera à la fin de la consultation.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Enregistrement refusé."); }
    finally { setBusy(false); }
  }

  function startEditing() {
    setForm(formFrom(draft));
    setMessage("");
    setEditing(true);
  }

  function toggleSymptom(symptom: string) {
    setForm((current) => ({ ...current, selected: current.selected.includes(symptom) ? current.selected.filter((item) => item !== symptom) : [...current.selected, symptom] }));
    setMessage("");
  }

  const setVital = (key: keyof VitalsForm, value: string) => { setForm((current) => ({ ...current, vitals: { ...current.vitals, [key]: value } })); setMessage(""); };

  return <div className="stack-lg" id="preparer">
    {showWizard && <section className="card preconsult-wizard preconsult-form" aria-labelledby="preconsult-title">
      <div className="preconsult-wizard__top"><span className="eyebrow">{draft ? "Modifier le brouillon" : "Préparer ma consultation"}</span></div>
      <h2 id="preconsult-title">Préparer ma consultation</h2>
      <p className="muted">Remplissez ce que vous savez : seul le motif est obligatoire. Un proche ou un infirmier peut vous aider.</p>
      <form onSubmit={save} noValidate>
        <fieldset className="preconsult-section">
          <legend><span className="preconsult-section__num">1</span>Quel est le motif de la consultation ?</legend>
          <label className="field preconsult-wizard__field"><span>Motif</span><input id="preconsult-reason" required maxLength={240} value={form.reason} onChange={(event) => { setForm({ ...form, reason: event.target.value }); setMessage(""); }} placeholder="Ex. fièvre depuis deux jours" /></label>
        </fieldset>

        <fieldset className="preconsult-section">
          <legend><span className="preconsult-section__num">2</span>Quels symptômes ou maux ressentez-vous ?</legend>
          <p className="muted preconsult-section__hint">Cochez ce qui correspond (facultatif).</p>
          <div className="symptom-grid" role="group" aria-label="Symptômes les plus fréquents">
            {SYMPTOMS.map((symptom) => <label key={symptom} className={`symptom-chip${form.selected.includes(symptom) ? " is-on" : ""}`}><input type="checkbox" checked={form.selected.includes(symptom)} onChange={() => toggleSymptom(symptom)} /><span>{symptom}</span></label>)}
          </div>
          <label className="field"><span>Autre symptôme, depuis quand, intensité (facultatif)</span><textarea maxLength={OTHER_MAX} rows={3} value={form.other} onChange={(event) => setForm({ ...form, other: event.target.value })} placeholder="Si votre symptôme n’est pas dans la liste, écrivez-le ici." /></label>
          {buildObservations({ selected: form.selected, other: form.other }).length > OBSERVATIONS_MAX && <p className="status" role="alert">Le texte est trop long : raccourcissez-le.</p>}
        </fieldset>

        <fieldset className="preconsult-section">
          <legend><span className="preconsult-section__num">3</span>Quelles constantes ont été relevées ?</legend>
          <p className="muted preconsult-section__hint">Seulement ce qui a été mesuré : laissez vide le reste. Tension et glycémie restent telles qu’écrites, sans conversion ni unité supposée.</p>
          <div className="vitals-grid" role="group" aria-label="Constantes relevées">{VITAL_FIELDS.map((field) => <label className="field" key={field.key}><span>{field.label}{field.unit ? ` (${field.unit})` : ""}</span>
            {isListed(field.key)
              ? <select value={form.vitals[field.key]} onChange={(event) => setVital(field.key, event.target.value)}><option value="">—</option>{numberOptions(field.key, form.vitals[field.key]).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              : <input type={field.freeText ? "text" : "number"} inputMode={field.freeText ? "text" : "decimal"} autoComplete="off" maxLength={field.freeText ? 24 : undefined} step={field.freeText ? undefined : field.step} min={field.freeText ? undefined : field.min} max={field.freeText ? undefined : field.max} value={form.vitals[field.key]} onChange={(event) => setVital(field.key, event.target.value)} placeholder={field.placeholder} />}
          </label>)}<p className="muted vitals-grid__hint">Tension et glycémie : saisissez la valeur comme elle apparaît sur le carnet, avec son unité si elle est indiquée.</p></div>
        </fieldset>

        <fieldset className="preconsult-section">
          <legend><span className="preconsult-section__num">4</span>Qui remplit avec le patient ? <small>(facultatif)</small></legend>
          <label className="field preconsult-wizard__field"><span>Personne qui aide</span><input maxLength={120} value={form.recorded_with_help} onChange={(event) => setForm({ ...form, recorded_with_help: event.target.value })} placeholder="Ex. infirmière Awa, un proche" /></label>
        </fieldset>

        <div className="preconsult-wizard__actions">
          {draft && <button type="button" className="button preconsult-wizard__back" disabled={busy} onClick={() => { setEditing(false); setMessage(""); }}>Annuler</button>}
          <button className="button primary preconsult-wizard__next" type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer le brouillon"}</button>
        </div>
        <p className="status" role="status" aria-live="polite">{message}</p>
      </form>
    </section>}

    {draft && !editing && <section className="card preconsult-draft" aria-labelledby="preconsult-draft-title">
      <div className="section-heading"><div><span className="eyebrow">Brouillon en cours</span><h2 id="preconsult-draft-title">{draft.reason || "Sans motif"}</h2></div><span className="badge pending">Brouillon</span></div>
      {draft.observations && <p className="preconsult-draft__text">{draft.observations}</p>}
      {describeVitals(draft.vitals).length > 0 && <p className="preconsult-draft__vitals"><strong>Constantes :</strong> {describeVitals(draft.vitals).map((line) => `${line.label} ${line.text}`).join(" · ")}</p>}
      {draft.recorded_with_help && <p className="muted">Rempli avec l’aide de : {draft.recorded_with_help}</p>}
      <p className="muted">Pour que le médecin le lise, montrez-lui votre QR d’accès temporaire. Vous pouvez encore modifier le brouillon.</p>
      <div className="actions"><button type="button" className="button" onClick={startEditing}>Modifier le brouillon</button><Link className="button primary" href="/patient/acces">Ouvrir mon QR d’accès</Link></div>
      <p className="status" role="status" aria-live="polite">{message}</p>
    </section>}

    <section className="card" aria-label="Pré-consultations clôturées">
      <div className="section-heading"><div><span className="eyebrow">Clôturées par un médecin</span><h2>Mes pré-consultations</h2></div><span className="count-badge">{items ? closed.length : "…"}</span></div>
      {items === null ? <div className="skeleton" role="status"><span className="sr-only">Chargement…</span><i /></div> : closed.length === 0 ? <p className="empty">Aucune pré-consultation clôturée pour le moment. Le médecin la clôture lorsqu’il signe votre consultation.</p> : <div className="stack">{closed.map((item) => <article className="record" key={item.id}><div><strong>{item.reason}</strong><p className="muted">{item.facility_label || "Établissement du médecin"}{item.closed_at ? ` · clôturée le ${new Date(item.closed_at).toLocaleDateString("fr-FR")}` : ""}</p></div><span className="badge measured">Clôturée</span></article>)}</div>}
    </section>
  </div>;
}
