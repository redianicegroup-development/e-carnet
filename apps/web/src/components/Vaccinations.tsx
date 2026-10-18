"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../infrastructure/api/client";

type Vaccination = { id: string; vaccine_name: string; dose_number: number | null; administered_on: string | null; batch_number: string; facility: string; professional: string; next_due_on: string | null; status: string; status_label: string; notes: string; created_at: string };
type Form = { vaccine_name: string; dose_number: string; administered_on: string; batch_number: string; facility: string; professional: string; next_due_on: string; notes: string };
const EMPTY: Form = { vaccine_name: "", dose_number: "", administered_on: "", batch_number: "", facility: "", professional: "", next_due_on: "", notes: "" };
const date = (value: string | null) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("fr-FR") : "Non renseignée";

export function Vaccinations() {
  const [items, setItems] = useState<Vaccination[] | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; apiGet<Vaccination[]>("/api/v1/patient/care/vaccinations/").then((data) => active && setItems(data)).catch((error) => active && setMessage(error instanceof Error ? error.message : "Vaccinations indisponibles.")); return () => { active = false; }; }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.vaccine_name.trim()) { setMessage("Indiquez le nom du vaccin."); return; }
    setBusy(true); setMessage("");
    try {
      const payload = { ...form, vaccine_name: form.vaccine_name.trim(), dose_number: form.dose_number ? Number(form.dose_number) : null, administered_on: form.administered_on || null, next_due_on: form.next_due_on || null };
      const created = await apiPost<Vaccination>("/api/v1/patient/care/vaccinations/", payload);
      setItems((current) => [created, ...(current ?? [])]); setForm(EMPTY); setMessage("Vaccination ajoutée. Elle est marquée « déclarée ».");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Vaccination refusée."); } finally { setBusy(false); }
  }
  return <section className="card" aria-labelledby="vaccinations-title">
    <div className="section-heading"><div><span className="eyebrow">Carnet de vaccination</span><h2 id="vaccinations-title">Mes vaccins</h2></div><span className="count-badge">{items?.length ?? "…"}</span></div>
    <p className="muted">Ajoutez vos vaccinations connues. Une vaccination ancienne inconnue n’est jamais considérée automatiquement comme non effectuée.</p>
    <form className="stack" onSubmit={submit}>
      <div className="patient-grid patient-grid--compact"><label className="field"><span>Nom du vaccin</span><input required maxLength={180} value={form.vaccine_name} onChange={(event) => setForm({ ...form, vaccine_name: event.target.value })} placeholder="Ex. BCG, COVID-19…" /></label><label className="field"><span>Numéro de dose (facultatif)</span><input type="number" min="1" max="99" value={form.dose_number} onChange={(event) => setForm({ ...form, dose_number: event.target.value })} /></label></div>
      <div className="patient-grid patient-grid--compact"><label className="field"><span>Date d’administration</span><input type="date" value={form.administered_on} onChange={(event) => setForm({ ...form, administered_on: event.target.value })} /></label><label className="field"><span>Prochain rappel</span><input type="date" value={form.next_due_on} onChange={(event) => setForm({ ...form, next_due_on: event.target.value })} /></label></div>
      <div className="patient-grid patient-grid--compact"><label className="field"><span>Centre ou établissement</span><input maxLength={180} value={form.facility} onChange={(event) => setForm({ ...form, facility: event.target.value })} /></label><label className="field"><span>Numéro de lot (facultatif)</span><input maxLength={100} value={form.batch_number} onChange={(event) => setForm({ ...form, batch_number: event.target.value })} /></label></div>
      <label className="field"><span>Note (facultatif)</span><input maxLength={500} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
      <button className="button primary" type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Ajouter au carnet"}</button><p className="status" role="status" aria-live="polite">{message}</p>
    </form>
    <div className="stack" aria-live="polite">{items === null ? <div className="skeleton" role="status"><span className="sr-only">Chargement…</span><i /></div> : items.length === 0 ? <p className="empty">Aucune vaccination renseignée pour le moment.</p> : items.map((item) => <article className="record" key={item.id}><div><strong>{item.vaccine_name}{item.dose_number ? ` · dose ${item.dose_number}` : ""}</strong><p className="muted">Administration : {date(item.administered_on)}{item.facility ? ` · ${item.facility}` : ""}</p>{item.next_due_on && <small className="muted">Rappel : {date(item.next_due_on)}</small>}</div><span className="badge declared">{item.status_label}</span></article>)}</div>
  </section>;
}
