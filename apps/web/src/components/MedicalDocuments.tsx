"use client";

import { useEffect, useRef, useState } from "react";
import { apiDelete, apiGet, apiUpload } from "../infrastructure/api/client";

export type MedicalDocument = {
  id: string; original_name: string; document_type: string; document_type_label: string;
  document_date: string | null; issuer: string; content_type: string; size_bytes: number;
  verified: boolean; exam_request_id: string | null; created_at: string; download_url: string;
};
type ExamRequest = { id: string; label: string; status: string };
type Consultation = { exam_requests?: ExamRequest[] };

const TYPES = [
  ["prescription", "Ordonnance"], ["analysis", "Analyse"], ["imaging", "Imagerie"],
  ["certificate", "Certificat"], ["report", "Compte rendu"], ["vaccination", "Carnet de vaccination"], ["other", "Autre document"],
] as const;
const MAX_SIZE = 10 * 1024 * 1024;

function readableSize(size: number) { return `${(size / 1024 / 1024).toFixed(size < 1024 * 1024 ? 2 : 1)} Mo`; }

export async function compressMedicalImage(file: File): Promise<File> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

export function MedicalDocuments() {
  const [items, setItems] = useState<MedicalDocument[] | null>(null);
  const [exams, setExams] = useState<ExamRequest[]>([]);
  const [kind, setKind] = useState("prescription");
  const [date, setDate] = useState("");
  const [issuer, setIssuer] = useState("");
  const [examRequestId, setExamRequestId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiGet<MedicalDocument[]>("/api/v1/patient/care/documents/"),
      apiGet<Consultation[]>("/api/v1/patient/care/consultations/").catch(() => []),
    ]).then(([documents, consultations]) => {
      if (!active) return;
      setItems(documents);
      setExams(consultations.flatMap((consultation) => (consultation.exam_requests ?? []).filter((exam) => exam.status === "requested")));
    }).catch((reason) => { if (active) { setItems([]); setError(reason instanceof Error ? reason.message : "Documents indisponibles."); } });
    return () => { active = false; };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const original = inputRef.current?.files?.[0];
    if (!original) { setError("Choisissez un fichier à importer."); return; }
    if (!/^(application\/pdf|image\/(png|jpeg|webp))$/.test(original.type) || !/\.(pdf|png|jpe?g|webp)$/i.test(original.name)) {
      setError("Format refusé : utilisez uniquement PDF, PNG, JPG/JPEG ou WebP."); return;
    }
    const file = await compressMedicalImage(original);
    if (file.size > MAX_SIZE) { setError("Le fichier ne doit pas dépasser 10 MiB."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const form = new FormData();
      form.append("file", file); form.append("document_type", kind);
      if (date) form.append("document_date", date);
      if (issuer.trim()) form.append("issuer", issuer.trim());
      if (examRequestId) form.append("exam_request_id", examRequestId);
      const created = await apiUpload<MedicalDocument>("/api/v1/patient/care/documents/", form);
      setItems((current) => [created, ...(current ?? [])]);
      setExams((current) => current.filter((exam) => exam.id !== examRequestId));
      setDate(""); setIssuer(""); setExamRequestId("");
      if (inputRef.current) inputRef.current.value = "";
      setMessage("Document ajouté à votre historique médical.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Import refusé."); }
    finally { setBusy(false); }
  }

  async function remove(item: MedicalDocument) {
    if (!window.confirm(`Supprimer « ${item.original_name} » ? Cette action est définitive.`)) return;
    setDeletingId(item.id); setError(""); setMessage("");
    try {
      await apiDelete(`/api/v1/patient/care/documents/${item.id}/`);
      setItems((current) => (current ?? []).filter((row) => row.id !== item.id));
      if (item.exam_request_id) {
        const consultations = await apiGet<Consultation[]>("/api/v1/patient/care/consultations/").catch(() => null);
        if (consultations) setExams(consultations.flatMap((consultation) => (consultation.exam_requests ?? []).filter((exam) => exam.status === "requested")));
      }
      setMessage("Document supprimé.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Le document n’a pas été supprimé."); }
    finally { setDeletingId(null); }
  }

  return <section className="card" aria-labelledby="documents-title">
    <div className="section-heading"><div><span className="eyebrow">Historique médical</span><h2 id="documents-title">Mes documents</h2></div><span className="count-badge">{items?.length ?? "…"}</span></div>
    <p className="muted">Importez un document privé en PDF, PNG, JPG/JPEG ou WebP. Les photos usuelles sont réduites côté appareil avant l’envoi.</p>
    <form className="stack" onSubmit={submit}>
      <label className="field"><span>Fichier (10 MiB maximum)</span><input ref={inputRef} required type="file" accept="application/pdf,image/png,image/jpeg,image/webp" /></label>
      <div className="patient-grid patient-grid--compact">
        <label className="field"><span>Type de document</span><select value={kind} onChange={(event) => setKind(event.target.value)}>{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="field"><span>Date du document (facultatif)</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      </div>
      {exams.length > 0 && <label className="field"><span>Résultat d’un examen demandé (facultatif)</span><select value={examRequestId} onChange={(event) => setExamRequestId(event.target.value)}><option value="">Ne pas associer</option>{exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.label}</option>)}</select></label>}
      <label className="field"><span>Établissement émetteur (facultatif)</span><input maxLength={180} value={issuer} onChange={(event) => setIssuer(event.target.value)} placeholder="Ex. Clinique…" /></label>
      <button className="button primary" type="submit" disabled={busy}>{busy ? "Import en cours…" : "Ajouter à mon historique"}</button>
      {error && <p className="status error" role="alert">{error}</p>}
      {message && <p className="status success" role="status" aria-live="polite">{message}</p>}
    </form>
    <div className="stack" aria-live="polite">
      {items === null ? <div className="skeleton" role="status"><span className="sr-only">Chargement…</span><i /></div> : items.length === 0 ? <p className="empty">Aucun document importé pour le moment.</p> : items.map((item) => <article className="record" key={item.id}><div><strong>{item.document_type_label}</strong><p className="muted">{item.original_name} · {readableSize(item.size_bytes)}{item.issuer ? ` · ${item.issuer}` : ""}</p>{item.document_date && <small className="muted">Document du {new Date(item.document_date).toLocaleDateString("fr-FR")}</small>}{item.exam_request_id && <small className="muted">Résultat associé à un examen demandé · non vérifié</small>}</div><div className="button-group"><a className="button small" href={item.download_url} target="_blank" rel="noreferrer">Consulter</a><button className="button small" type="button" onClick={() => remove(item)} disabled={deletingId === item.id}>{deletingId === item.id ? "Suppression…" : "Supprimer"}</button></div></article>)}
    </div>
  </section>;
}
