"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPatch, apiPost } from "../infrastructure/api/client";
import { describeVitals, emptyVitalsForm, parseVitalsForm, vitalsToForm, VITAL_FIELDS, type StoredVitals, type VitalsForm } from "../lib/vitals";
import { buildObservations, isListed, numberOptions, OBSERVATIONS_MAX, OTHER_MAX, parseObservations, SYMPTOMS } from "../lib/preconsult";
import "./preconsult-form.css";

type TemplateField = { key: string; label: string; type: "text" | "number" | "choice" | "yes_no"; unit: string; required: boolean; options: string[] };
type ActiveTemplate = { id: string; name: string; establishment_id: string; establishment_name: string; fields: TemplateField[] };
type Encounter = { id: string; facility_label: string; establishment_id?: string | null; reason: string; observations: string; vitals?: StoredVitals; recorded_with_help?: string; preconsultation_template?: string | null; template_fields?: TemplateField[]; template_responses?: Record<string, string | number | boolean | null>; status: "draft" | "closed"; closed_at: string | null; provenance: { label: string } };
type FormState = { reason: string; selected: string[]; other: string; vitals: VitalsForm; recorded_with_help: string; templateId: string; templateResponses: Record<string, string | number | boolean | null>; templateFields: TemplateField[] };
const EMPTY_FORM: FormState = { reason: "", selected: [], other: "", vitals: emptyVitalsForm(), recorded_with_help: "", templateId: "", templateResponses: {}, templateFields: [] };

function fetchPreconsultationData() {
  return Promise.all([
    apiGet<Encounter[]>("/api/v1/patient/care/encounters/"),
    apiGet<ActiveTemplate[]>("/api/v1/patient/care/patient/preconsultation-templates/"),
  ]);
}

/* Un seul bloc, quatre sections (motif, symptômes, constantes, personne qui aide) : plus d'étapes à enchaîner.
   Aucun établissement à choisir : c'est le médecin qui lit ce brouillon grâce au QR du patient, puis le clôture en signant sa consultation.
   La personne qui aide (souvent un infirmier sans compte) remplit sur le téléphone du patient. */
function formFrom(item: Encounter | null): FormState {
  if (!item) return { ...EMPTY_FORM, selected: [], vitals: emptyVitalsForm() };
  const symptoms = parseObservations(item.observations);
  return { reason: item.reason, selected: symptoms.selected, other: symptoms.other, vitals: vitalsToForm(item.vitals), recorded_with_help: item.recorded_with_help ?? "", templateId: item.preconsultation_template ? String(item.preconsultation_template) : "", templateResponses: item.template_responses ?? {}, templateFields: item.template_fields ?? [] };
}

export function PatientPreconsultations({ onDraftChange }: { onDraftChange?: (hasDraft: boolean) => void }) {
  const [items, setItems] = useState<Encounter[] | null>(null);
  const [templates, setTemplates] = useState<ActiveTemplate[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retryNeeded, setRetryNeeded] = useState(false);

  const reloadItems = useCallback(async () => {
    setLoadingItems(true);
    setLoadError("");
    try {
      const [encounters, activeTemplates] = await fetchPreconsultationData();
      setItems(encounters);
      setTemplates(activeTemplates);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Pré-consultation indisponible.");
    } finally {
      setLoadingItems(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchPreconsultationData()
      .then(([encounters, activeTemplates]) => { if (active) { setItems(encounters); setTemplates(activeTemplates); } })
      .catch((error) => { if (active) setLoadError(error instanceof Error ? error.message : "Pré-consultation indisponible."); })
      .finally(() => { if (active) setLoadingItems(false); });
    return () => { active = false; };
  }, []);

  const draft = (items ?? []).find((item) => item.status === "draft") ?? null;
  const showWizard = items !== null && (!draft || editing);
  const hasDraft = Boolean(draft);
  // La pré-consultation est « faite » dès qu'un brouillon est enregistré : l'écran des consultations en tire l'étape 2 (accès temporaire).
  useEffect(() => { if (items !== null) onDraftChange?.(hasDraft); }, [items, hasDraft, onDraftChange]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!form.reason.trim()) { setMessage("Indiquez le motif de la consultation pour continuer."); document.getElementById("preconsult-reason")?.focus(); return; }
    if (form.templateId && form.templateFields.some((field) => field.required && (form.templateResponses[field.key] === null || form.templateResponses[field.key] === undefined || form.templateResponses[field.key] === ""))) { setMessage("Complétez les champs obligatoires du modèle d’établissement."); return; }
    // Les constantes sont vérifiées ici : une valeur impossible n'est jamais envoyée.
    const parsedVitals = parseVitalsForm(form.vitals);
    if (!parsedVitals.ok) { setMessage(parsedVitals.message); return; }
    setBusy(true);
    setMessage("");
    try {
      const payload = { reason: form.reason.trim(), observations: buildObservations({ selected: form.selected, other: form.other }), vitals: parsedVitals.vitals, recorded_with_help: form.recorded_with_help.trim(), preconsultation_template: form.templateId || null, template_responses: form.templateId ? form.templateResponses : {} };
      // Après un échec réseau, le serveur a peut-être enregistré le POST sans que la réponse soit arrivée.
      // On relit d'abord le brouillon : on le met à jour s'il existe, sinon seulement on retente la création.
      const currentDraft = retryNeeded
        ? (await apiGet<Encounter[]>("/api/v1/patient/care/encounters/")).find((item) => item.status === "draft") ?? null
        : draft;
      const saved = currentDraft
        ? await apiPatch<Encounter>(`/api/v1/patient/care/encounters/${currentDraft.id}/`, payload)
        : await apiPost<Encounter>("/api/v1/patient/care/encounters/", payload);
      setItems((current) => currentDraft && (current ?? []).some((item) => item.id === saved.id)
        ? (current ?? []).map((item) => (item.id === saved.id ? saved : item))
        : [saved, ...(current ?? []).filter((item) => item.id !== saved.id)]);
      setRetryNeeded(false);
      setEditing(false);
      setForm({ ...EMPTY_FORM, selected: [], vitals: emptyVitalsForm() });
      setMessage("Enregistré. Pour le médecin, ouvrez votre QR temporaire.");
    } catch (error) {
      const status = error && typeof error === "object" && "status" in error ? Number((error as { status?: unknown }).status) : -1;
      setRetryNeeded(error instanceof TypeError || status === 0 || status === 409 || status >= 500);
      setMessage(error instanceof Error ? error.message : "Enregistrement refusé.");
    }
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
    {items === null && <section className="card" aria-busy={loadingItems} aria-labelledby="preconsult-loading-title">
      <h2 id="preconsult-loading-title">Pré-consultation</h2>
      <p className="muted" role={loadError ? "alert" : "status"}>{loadError || "Chargement de la pré-consultation…"}</p>
      {loadError && <button type="button" className="button" onClick={() => void reloadItems()} disabled={loadingItems}>Réessayer</button>}
    </section>}
    {showWizard && <section className="card preconsult-wizard preconsult-form" aria-labelledby="preconsult-title">
      <div className="preconsult-wizard__top"><span className="eyebrow">{draft ? "Modifier le brouillon" : "Préparer ma consultation"}</span></div>
      <h2 id="preconsult-title">Préparer ma consultation</h2>
      <p className="muted">L’infirmier ou le médecin peut remplir ce formulaire avec vous. Seul le motif est obligatoire.</p>
      <form onSubmit={save} noValidate>
        <fieldset className="preconsult-section">
          <legend><span className="preconsult-section__num">1</span>Quel est le motif de la consultation ?</legend>
          <label className="field preconsult-wizard__field"><span>Motif</span><input id="preconsult-reason" required maxLength={240} value={form.reason} onChange={(event) => { setForm({ ...form, reason: event.target.value }); setMessage(""); }} placeholder="Ex. fièvre depuis deux jours" /></label>
        </fieldset>

        {templates.length > 0 && <fieldset className="preconsult-section"><legend><span className="preconsult-section__num">+</span>Formulaire de l’établissement (facultatif)</legend><label className="field"><span>Modèle lié à un rendez-vous à venir</span><select value={form.templateId} onChange={(event) => { const id = event.target.value; const template = templates.find((item) => item.id === id); setForm((current) => ({ ...current, templateId: id, templateResponses: id === current.templateId ? current.templateResponses : Object.fromEntries((template?.fields ?? []).map((field) => [field.key, null])), templateFields: template?.fields ?? [] })); }}><option value="">Aucun modèle</option>{form.templateId && !templates.some((item) => item.id === form.templateId) && <option value={form.templateId}>Modèle déjà associé à ce brouillon</option>}{templates.map((item) => <option key={item.id} value={item.id}>{item.establishment_name} · {item.name}</option>)}</select></label>{form.templateFields.map((field) => <label className="field" key={field.key}><span>{field.label}{field.required ? " *" : ""}{field.unit ? ` (${field.unit})` : ""}</span>{field.type === "choice" || field.type === "yes_no" ? <select value={String(form.templateResponses[field.key] ?? "")} onChange={(event) => { const raw = event.target.value; setForm((current) => ({ ...current, templateResponses: { ...current.templateResponses, [field.key]: raw === "" ? null : field.type === "yes_no" ? raw === "true" : raw } })); }}><option value="">Choisir…</option>{(field.type === "choice" ? field.options.map((value) => [value, value] as const) : [["true", "Oui"], ["false", "Non"]] as const).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> : <input type={field.type === "number" ? "number" : "text"} value={String(form.templateResponses[field.key] ?? "")} onChange={(event) => setForm((current) => ({ ...current, templateResponses: { ...current.templateResponses, [field.key]: event.target.value || null } }))} />}</label>)}<p className="muted">Seuls les modèles validés médicalement et liés à un rendez-vous à venir sont proposés.</p></fieldset>}
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
          <button className="button primary preconsult-wizard__next" type="submit" disabled={busy}>{busy ? "Enregistrement…" : retryNeeded ? "Réessayer l’enregistrement" : "Enregistrer le brouillon"}</button>
        </div>
        <p className="status" role="status" aria-live="polite">{message}</p>
        {retryNeeded && <p className="muted" role="note">L’envoi n’est pas confirmé. Vos réponses restent affichées. Reconnectez-vous puis réessayez. Rien n’est envoyé hors connexion.</p>}
      </form>
    </section>}

    {draft && !editing && <section className="card preconsult-draft" aria-labelledby="preconsult-draft-title">
      <div className="section-heading"><div><span className="eyebrow">Brouillon en cours</span><h2 id="preconsult-draft-title">{draft.reason || "Sans motif"}</h2></div><span className="badge pending">Brouillon</span></div>
      {draft.observations && <p className="preconsult-draft__text">{draft.observations}</p>}
      {draft.template_fields && Object.keys(draft.template_responses ?? {}).length > 0 && <dl className="kv">{Object.entries(draft.template_responses ?? {}).map(([key, value]) => { const field = draft.template_fields?.find((item) => item.key === key); return <div key={key}><dt>{field?.label ?? key}</dt><dd>{typeof value === "boolean" ? (value ? "Oui" : "Non") : String(value ?? "—")}{field?.unit ? ` ${field.unit}` : ""}</dd></div>; })}</dl>}
      {describeVitals(draft.vitals).length > 0 && <p className="preconsult-draft__vitals"><strong>Constantes :</strong> {describeVitals(draft.vitals).map((line) => `${line.label} ${line.text}`).join(" · ")}</p>}
      {draft.recorded_with_help && <p className="muted">Rempli avec l’aide de : {draft.recorded_with_help}</p>}
      <p className="muted">Montrez votre QR temporaire au médecin. Vous pouvez encore modifier ce brouillon.</p>
      <div className="actions"><button type="button" className="button" onClick={startEditing}>Modifier le brouillon</button><Link className="button primary" href="/patient/acces">Ouvrir mon QR d’accès</Link></div>
      <p className="status" role="status" aria-live="polite">{message}</p>
    </section>}
  </div>;
}
