"use client";
import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPatch, apiPost } from "../infrastructure/api/client";

type TemplateField = { key: string; label: string; type: "text" | "number" | "choice" | "yes_no"; unit: string; required: boolean; options: string[] };
type Template = { id: string; name: string; active: boolean; status: "draft" | "active" | "disabled"; fields: TemplateField[]; approved_at: string | null; approved_by: string | null };
type Establishment = { id: string; name: string; status: string };
type Member = { id: string; professional: string; status: string; professional_name?: string; professional_specialty?: string; is_medical_referent: boolean; professional_verification_status?: string };
const EMPTY_FIELD = (): TemplateField => ({ key: "", label: "", type: "text", unit: "", required: false, options: [] });
function statusLabel(status: Template["status"]) { return status === "active" ? "Actif · validé médicalement" : status === "disabled" ? "Désactivé" : "Brouillon · en attente de validation"; }
export function EstablishmentPreconsultationTemplates() {
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [establishmentId, setEstablishmentId] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const selected = templates.find((item) => item.id === selectedId) ?? null;
  const endpoint = useMemo(() => establishmentId ? `/api/v1/patient/care/establishments/${establishmentId}/preconsultation-templates/` : "", [establishmentId]);
  async function load(id = establishmentId) {
    if (!id) return;
    setLoading(true); setError("");
    try {
      const [items, roster] = await Promise.all([
        apiGet<Template[]>(`/api/v1/patient/care/establishments/${id}/preconsultation-templates/`),
        apiGet<Member[]>(`/api/v1/establishments/${id}/memberships/`),
      ]);
      setTemplates(items); setMembers(roster);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de charger les modèles."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    apiGet<Establishment[]>("/api/v1/establishments/").then((items) => {
      if (!active) return;
      const available = items.filter((item) => item.status === "active"); setEstablishments(available);
      if (available.length) setEstablishmentId(available[0].id); else setLoading(false);
    }).catch((cause) => { if (active) { setError(cause instanceof Error ? cause.message : "Impossible de charger les établissements."); setLoading(false); } });
    return () => { active = false; };
  }, []);
  useEffect(() => { if (establishmentId) void load(establishmentId); }, [establishmentId]);
  function selectTemplate(item: Template) { setSelectedId(item.id); setName(item.name); setFields(item.fields.map((field) => ({ ...field, options: [...(field.options ?? [])] }))); setMessage(""); setPreview(false); }
  function resetEditor() { setSelectedId(""); setName(""); setFields([]); setPreview(false); setMessage(""); }
  function setField(index: number, patch: Partial<TemplateField>) { setFields((current) => current.map((field, i) => i === index ? { ...field, ...patch } : field)); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const payload = { name: name.trim(), fields };
      if (selected) await apiPatch(`${endpoint}${selected.id}/`, payload);
      else await apiPost(endpoint, payload);
      await load(); resetEditor(); setMessage("Modèle enregistré en brouillon. Un référent médical doit le valider avant toute utilisation.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Enregistrement impossible."); }
    finally { setBusy(false); }
  }
  async function deactivate(item: Template) {
    if (!window.confirm(`Désactiver « ${item.name} » ? Il ne sera plus proposé aux patients.`)) return;
    setBusy(true); setError("");
    try { await apiPost(`${endpoint}${item.id}/`, { action: "deactivate" }); await load(); if (selectedId === item.id) resetEditor(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Désactivation impossible."); }
    finally { setBusy(false); }
  }
  async function designate(member: Member, enabled: boolean) {
    setBusy(true); setError("");
    try { await apiPost(`/api/v1/establishments/${establishmentId}/memberships/${member.id}/medical-referent/`, { is_medical_referent: enabled }); await load(); setMessage(enabled ? "Référent médical désigné." : "Désignation retirée."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Mise à jour impossible."); }
    finally { setBusy(false); }
  }
  const approvedRoster = members.filter((member) => member.status === "active");
  return <div className="stack-lg">
    <section className="hero-page"><h1>Modèles de pré-consultation</h1><p className="muted">Champs proposés aux patients avant un rendez-vous. Un nouveau modèle reste en brouillon jusqu’à la validation d’un référent médical.</p></section>
    {establishments.length > 1 && <label className="field"><span>Établissement</span><select value={establishmentId} onChange={(event) => { setEstablishmentId(event.target.value); resetEditor(); }} aria-label="Établissement actif">{establishments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    {message && <p className="notice" role="status" aria-live="polite">{message}</p>}{error && <p className="notice" role="alert">{error}</p>}
    {loading ? <div className="skeleton" role="status" aria-label="Chargement des modèles"><i /><i /></div> : !establishmentId ? <section className="card empty"><h2>Aucun établissement actif</h2><p>Les modèles sont disponibles lorsque votre structure est active.</p></section> : <div className="grid establishment-template-layout">
      <section className="card stack" aria-labelledby="templates-list-title"><div className="section-heading"><div><h2 id="templates-list-title">Modèles enregistrés</h2></div><button className="button primary" type="button" onClick={resetEditor}>Nouveau modèle</button></div>
        {templates.length === 0 ? <p className="empty">Aucun modèle pour le moment. Créez un premier brouillon ; il ne sera pas proposé aux patients avant validation médicale.</p> : templates.map((item) => <article className="record" key={item.id}><div><strong>{item.name}</strong><p className="muted">{statusLabel(item.status)} · {item.fields.length} champ{item.fields.length === 1 ? "" : "s"}</p>{item.approved_at && <small>Validé le {new Date(item.approved_at).toLocaleDateString("fr-FR")}</small>}</div><div className="actions"><button className="button small" type="button" onClick={() => selectTemplate(item)} disabled={busy || item.status === "active"}>Modifier</button>{item.status === "active" && <button className="button small" type="button" onClick={() => void deactivate(item)} disabled={busy}>Désactiver</button>}</div></article>)}
      </section>
      <section className="card stack" aria-labelledby="template-editor-title"><div><h2 id="template-editor-title">{selected ? `Modifier « ${selected.name} »` : "Créer un modèle"}</h2></div>
        <form className="stack" onSubmit={save}><label className="field"><span>Nom du modèle</span><input required maxLength={180} value={name} onChange={(event) => setName(event.target.value)} /></label>
          {fields.map((field, index) => <fieldset className="visit-block" key={`${field.key}-${index}`}><legend>Champ {index + 1}</legend><div className="grid"><label className="field"><span>Clé technique</span><input required maxLength={40} pattern="[a-z][a-z0-9_]{0,39}" value={field.key} onChange={(event) => setField(index, { key: event.target.value })} placeholder="ex: temperature" /></label><label className="field"><span>Libellé affiché</span><input required maxLength={100} value={field.label} onChange={(event) => setField(index, { label: event.target.value })} /></label><label className="field"><span>Type</span><select value={field.type} onChange={(event) => setField(index, { type: event.target.value as TemplateField["type"], options: event.target.value === "choice" ? field.options : [], unit: event.target.value === "number" ? field.unit : "" })}><option value="text">Texte</option><option value="number">Nombre</option><option value="choice">Choix</option><option value="yes_no">Oui / non</option></select></label>{field.type === "number" && <label className="field"><span>Unité (facultative)</span><input maxLength={24} value={field.unit} onChange={(event) => setField(index, { unit: event.target.value })} placeholder="kg, °C…" /></label>}{field.type === "choice" && <label className="field"><span>Choix (un par ligne)</span><textarea required rows={3} value={field.options.join("\n")} onChange={(event) => setField(index, { options: event.target.value.split("\n").map((value) => value.trim()).filter(Boolean) })} /></label>}<label className="field"><span><input type="checkbox" checked={field.required} onChange={(event) => setField(index, { required: event.target.checked })} /> Obligatoire</span></label></div><div className="actions"><button className="button small" type="button" disabled={!index} onClick={() => setFields((current) => { const copy = [...current]; [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]]; return copy; })}>Monter</button><button className="button small" type="button" disabled={index === fields.length - 1} onClick={() => setFields((current) => { const copy = [...current]; [copy[index + 1], copy[index]] = [copy[index], copy[index + 1]]; return copy; })}>Descendre</button><button className="button small" type="button" onClick={() => setFields((current) => current.filter((_, i) => i !== index))}>Retirer</button></div></fieldset>)}
          <button className="button" type="button" disabled={fields.length >= 30} onClick={() => setFields((current) => [...current, EMPTY_FIELD()])}>Ajouter un champ ({fields.length}/30)</button><div className="actions"><button className="button" type="button" onClick={() => setPreview((value) => !value)}>{preview ? "Masquer l’aperçu" : "Aperçu patient"}</button><button className="button primary" type="submit" disabled={busy || !name.trim()}>{busy ? "Enregistrement…" : selected ? "Enregistrer les modifications" : "Créer le brouillon"}</button></div>
        </form>
        {preview && <section className="preconsult-preview" aria-label="Aperçu du formulaire patient"><h3>Aperçu patient · {name || "Sans titre"}</h3>{fields.length ? fields.map((field, index) => <div className="field" key={`${field.key}-${index}`}><label>{field.label}{field.required ? " *" : ""}{field.unit ? ` (${field.unit})` : ""}</label>{field.type === "choice" ? <select disabled><option>Choisir…</option>{field.options.map((option) => <option key={option}>{option}</option>)}</select> : field.type === "yes_no" ? <select disabled><option>Choisir…</option><option>Oui</option><option>Non</option></select> : <input disabled type={field.type === "number" ? "number" : "text"} />}</div>) : <p className="muted">Ajoutez des champs pour prévisualiser le formulaire.</p>}</section>}
      </section>
    </div>}
    {!loading && establishmentId && <section className="card stack"><div><h2>Référents médicaux</h2><p className="muted">Seuls ces médecins peuvent valider un modèle. Chaque validation est enregistrée.</p></div>{approvedRoster.length ? approvedRoster.map((member) => <article className="record" key={member.id}><div><strong>{member.professional_name || member.professional_specialty || "Professionnel de santé"}</strong><p className="muted">{member.professional_specialty || "Membre actif"}</p></div>{member.professional_verification_status === "verified" ? <button type="button" className={`button small${member.is_medical_referent ? " primary" : ""}`} disabled={busy} onClick={() => void designate(member, !member.is_medical_referent)}>{member.is_medical_referent ? "Retirer la qualité de référent" : "Désigner comme référent médical"}</button> : <span className="badge pending">Vérification professionnelle requise</span>}</article>) : <p className="empty">Aucun professionnel rattaché et actif pour le moment.</p>}<p className="muted">Les référents peuvent valider les brouillons dans leur espace professionnel, rubrique Consultations.</p></section>}
  </div>;
}
