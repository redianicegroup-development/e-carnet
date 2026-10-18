"use client";

import { useEffect, useRef, useState } from "react";
import { apiDelete, apiGet, apiPost, apiUpload } from "../infrastructure/api/client";
import { compressMedicalImage } from "./MedicalDocuments";
import type { MedicalDocument } from "./MedicalDocuments";

type Vaccination = {
  id: string; vaccine_name: string; dose_number: number | null; administered_on: string | null;
  batch_number: string; facility: string; professional: string; next_due_on: string | null;
  document_id: string | null; confirmed_by_name: string; confirmed_at: string | null;
  status: "declared" | "documented" | "confirmed"; status_label: string; notes: string; created_at: string;
};
type Form = {
  vaccine_name: string; dose_number: string; administered_on: string; batch_number: string;
  facility: string; professional: string; next_due_on: string; notes: string; document_id: string;
};
const EMPTY: Form = { vaccine_name: "", dose_number: "", administered_on: "", batch_number: "", facility: "", professional: "", next_due_on: "", notes: "", document_id: "" };
const VACCINE_PRESETS = ["BCG", "DT-Coq-Polio", "DT-Coq-Polio (rappel)", "Rougeole", "Fièvre jaune", "Autre"];
const MAX_SIZE = 10 * 1024 * 1024;
const date = (value: string | null) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("fr-FR") : "Non renseignée";

export function Vaccinations() {
  const [items, setItems] = useState<Vaccination[] | null>(null);
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [form, setForm] = useState<Form>(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiGet<Vaccination[]>("/api/v1/patient/care/vaccinations/"),
      apiGet<MedicalDocument[]>("/api/v1/patient/care/documents/").catch(() => []),
    ]).then(([vaccinations, docs]) => {
      if (!active) return;
      setItems(vaccinations);
      setDocuments(docs.filter((document) => document.document_type === "vaccination"));
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : "Carnet de vaccination indisponible.");
    });
    return () => { active = false; };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.vaccine_name.trim()) { setError("Indiquez le nom du vaccin."); return; }
    if (form.dose_number && (!/^\d+$/.test(form.dose_number) || Number(form.dose_number) < 1 || Number(form.dose_number) > 99)) {
      setError("Le numéro de dose doit être compris entre 1 et 99."); return;
    }
    setBusy(true); setError(""); setMessage("");
    let newlyUploaded: MedicalDocument | null = null;
    try {
      let documentId = form.document_id;
      if (file) {
        const compressed = await compressMedicalImage(file);
        if (!/^(application\/pdf|image\/(png|jpeg|webp))$/.test(compressed.type) || !/\.(pdf|png|jpe?g|webp)$/i.test(compressed.name)) {
          throw new Error("Format refusé : utilisez uniquement PDF, PNG, JPG/JPEG ou WebP.");
        }
        if (compressed.size > MAX_SIZE) throw new Error("Le fichier ne doit pas dépasser 10 MiB après compression.");
        const body = new FormData();
        body.append("file", compressed);
        body.append("document_type", "vaccination");
        if (form.administered_on) body.append("document_date", form.administered_on);
        if (form.facility.trim()) body.append("issuer", form.facility.trim());
        newlyUploaded = await apiUpload<MedicalDocument>("/api/v1/patient/care/documents/", body);
        documentId = newlyUploaded.id;
        setDocuments((current) => [newlyUploaded as MedicalDocument, ...current]);
      }
      const payload = {
        vaccine_name: form.vaccine_name.trim(),
        dose_number: form.dose_number ? Number(form.dose_number) : null,
        administered_on: form.administered_on || null,
        batch_number: form.batch_number.trim(),
        facility: form.facility.trim(),
        professional: form.professional.trim(),
        next_due_on: form.next_due_on || null,
        notes: form.notes.trim(),
        document_id: documentId || null,
      };
      const created = await apiPost<Vaccination>("/api/v1/patient/care/vaccinations/", payload);
      setItems((current) => [created, ...(current ?? [])]);
      setForm(EMPTY); setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setMessage(created.document_id ? "Vaccination ajoutée et documentée par votre justificatif. Elle reste à confirmer par un professionnel." : "Vaccination ajoutée comme déclarée. Un professionnel pourra la confirmer après vérification.");
    } catch (reason) {
      if (newlyUploaded) {
        try {
          await apiDelete(`/api/v1/patient/care/documents/${newlyUploaded.id}/`);
          setDocuments((current) => current.filter((document) => document.id !== newlyUploaded?.id));
        } catch {
          setMessage("Le justificatif a été conservé dans Mes documents, mais la vaccination n’a pas pu être créée.");
        }
      }
      setError(reason instanceof Error ? reason.message : "Vaccination refusée.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="card" id="vaccinations" aria-labelledby="vaccinations-title">
    <div className="section-heading"><div><span className="eyebrow">Carnet de vaccination</span><h2 id="vaccinations-title">Mes vaccins</h2></div><span className="count-badge">{items?.length ?? "…"}</span></div>
    <p className="muted">Une vaccination sans pièce reste « déclarée ». Un justificatif la rend « documentée » ; seul un professionnel autorisé peut la confirmer. Une vaccination ancienne inconnue n’est jamais considérée automatiquement comme non effectuée.</p>
    <form className="stack" onSubmit={submit}>
      <div className="patient-grid patient-grid--compact">
        <label className="field"><span>Nom du vaccin</span><input required maxLength={180} list="vaccination-presets" value={form.vaccine_name} onChange={(event) => setForm({ ...form, vaccine_name: event.target.value })} placeholder="Choisissez ou saisissez un vaccin" /><datalist id="vaccination-presets">{VACCINE_PRESETS.map((name) => <option key={name} value={name} />)}</datalist></label>
        <label className="field"><span>Numéro de dose (facultatif)</span><input type="number" min="1" max="99" step="1" value={form.dose_number} onChange={(event) => setForm({ ...form, dose_number: event.target.value })} /></label>
      </div>
      <div className="patient-grid patient-grid--compact"><label className="field"><span>Date d’administration</span><input type="date" value={form.administered_on} onChange={(event) => setForm({ ...form, administered_on: event.target.value })} /></label><label className="field"><span>Prochain rappel (si déjà indiqué)</span><input type="date" value={form.next_due_on} onChange={(event) => setForm({ ...form, next_due_on: event.target.value })} /></label></div>
      <div className="patient-grid patient-grid--compact"><label className="field"><span>Centre ou établissement</span><input maxLength={180} value={form.facility} onChange={(event) => setForm({ ...form, facility: event.target.value })} /></label><label className="field"><span>Numéro de lot (facultatif)</span><input maxLength={100} value={form.batch_number} onChange={(event) => setForm({ ...form, batch_number: event.target.value })} /></label></div>
      <label className="field"><span>Professionnel indiqué sur le carnet (déclaratif, non vérifié)</span><input maxLength={180} value={form.professional} onChange={(event) => setForm({ ...form, professional: event.target.value })} /></label>
      <label className="field"><span>Photo du carnet ou justificatif (facultatif, PDF/PNG/JPG/WebP, 10 MiB maximum)</span><input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" capture="environment" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
      {documents.length > 0 && <label className="field"><span>Ou rattacher un justificatif déjà importé</span><select value={form.document_id} onChange={(event) => setForm({ ...form, document_id: event.target.value })}><option value="">Aucun justificatif existant</option>{documents.map((document) => <option key={document.id} value={document.id}>{document.original_name}</option>)}</select></label>}
      <label className="field"><span>Note (facultatif)</span><input maxLength={500} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
      <button className="button primary" type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Ajouter au carnet"}</button>
      {error && <p className="status error" role="alert">{error}</p>}
      {message && <p className="status" role="status" aria-live="polite">{message}</p>}
    </form>
    <div className="stack" aria-live="polite">
      {items === null ? <div className="skeleton" role="status"><span className="sr-only">Chargement…</span><i /></div> : items.length === 0 ? <p className="empty">Aucune vaccination renseignée pour le moment.</p> : items.map((item) => <article className="record" key={item.id}>
        <div><strong>{item.vaccine_name}{item.dose_number ? ` · dose ${item.dose_number}` : ""}</strong><p className="muted">Administration : {date(item.administered_on)}{item.facility ? ` · ${item.facility}` : ""}</p>
          {item.next_due_on && <small className="muted">Rappel déjà indiqué : {date(item.next_due_on)}</small>}
          {item.document_id && <small className="muted"><br />Justificatif joint · non vérifié</small>}
          {item.confirmed_by_name && item.confirmed_at && <small className="muted"><br />Vérifiée le {new Date(item.confirmed_at).toLocaleDateString("fr-FR")} par {item.confirmed_by_name}</small>}
        </div><span className={`badge ${item.status === "confirmed" ? "verified" : item.status === "documented" ? "pending" : "declared"}`}>{item.status_label}</span>
      </article>)}
    </div>
  </section>;
}
