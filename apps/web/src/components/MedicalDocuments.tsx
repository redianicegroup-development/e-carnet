"use client";

import { useEffect, useRef, useState } from "react";
import { apiGet, apiUpload } from "../infrastructure/api/client";

export type MedicalDocument = {
  id: string;
  original_name: string;
  document_type: string;
  document_type_label: string;
  document_date: string | null;
  issuer: string;
  content_type: string;
  size_bytes: number;
  verified: boolean;
  created_at: string;
  download_url: string;
};

const TYPES = [
  ["prescription", "Ordonnance"], ["analysis", "Analyse"], ["imaging", "Imagerie"],
  ["certificate", "Certificat"], ["report", "Compte rendu"], ["other", "Autre document"],
] as const;
const MAX_SIZE = 10 * 1024 * 1024;

function readableSize(size: number) {
  return `${(size / 1024 / 1024).toFixed(size < 1024 * 1024 ? 2 : 1)} Mo`;
}

export function MedicalDocuments() {
  const [items, setItems] = useState<MedicalDocument[] | null>(null);
  const [kind, setKind] = useState("prescription");
  const [date, setDate] = useState("");
  const [issuer, setIssuer] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    apiGet<MedicalDocument[]>("/api/v1/patient/care/documents/")
      .then((data) => active && setItems(data))
      .catch((error) => active && setMessage(error instanceof Error ? error.message : "Documents indisponibles."));
    return () => { active = false; };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) { setMessage("Choisissez un fichier à importer."); return; }
    if (!/^(application\/pdf|image\/(png|jpeg))$/.test(file.type) || !/\.(pdf|png|jpe?g)$/i.test(file.name)) {
      setMessage("Format refusé : utilisez uniquement PDF, PNG ou JPG."); return;
    }
    if (file.size > MAX_SIZE) { setMessage("Le fichier ne doit pas dépasser 10 Mo."); return; }
    setBusy(true); setMessage("");
    try {
      const form = new FormData();
      form.append("file", file); form.append("document_type", kind);
      if (date) form.append("document_date", date);
      if (issuer.trim()) form.append("issuer", issuer.trim());
      const created = await apiUpload<MedicalDocument>("/api/v1/patient/care/documents/", form);
      setItems((current) => [created, ...(current ?? [])]);
      setDate(""); setIssuer("");
      if (inputRef.current) inputRef.current.value = "";
      setMessage("Document ajouté à votre historique médical.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Import refusé."); }
    finally { setBusy(false); }
  }

  return <section className="card" aria-labelledby="documents-title">
    <div className="section-heading"><div><span className="eyebrow">Historique médical</span><h2 id="documents-title">Mes documents</h2></div><span className="count-badge">{items?.length ?? "…"}</span></div>
    <p className="muted">Importez une ordonnance papier, une analyse ou un compte rendu en PDF, PNG ou JPG. Les documents restent privés et ne sont pas partagés par le QR professionnel.</p>
    <form className="stack" onSubmit={submit}>
      <label className="field"><span>Fichier (10 Mo maximum)</span><input ref={inputRef} required type="file" accept="application/pdf,image/png,image/jpeg" /></label>
      <div className="patient-grid patient-grid--compact">
        <label className="field"><span>Type de document</span><select value={kind} onChange={(event) => setKind(event.target.value)}>{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="field"><span>Date du document (facultatif)</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      </div>
      <label className="field"><span>Établissement émetteur (facultatif)</span><input maxLength={180} value={issuer} onChange={(event) => setIssuer(event.target.value)} placeholder="Ex. Clinique…" /></label>
      <button className="button primary" type="submit" disabled={busy}>{busy ? "Import en cours…" : "Ajouter à mon historique"}</button>
      <p className="status" role="status" aria-live="polite">{message}</p>
    </form>
    <div className="stack" aria-live="polite">
      {items === null ? <div className="skeleton" role="status"><span className="sr-only">Chargement…</span><i /></div> : items.length === 0 ? <p className="empty">Aucun document importé pour le moment.</p> : items.map((item) => <article className="record" key={item.id}><div><strong>{item.document_type_label}</strong><p className="muted">{item.original_name} · {readableSize(item.size_bytes)}{item.issuer ? ` · ${item.issuer}` : ""}</p>{item.document_date && <small className="muted">Document du {new Date(item.document_date).toLocaleDateString("fr-FR")}</small>}</div><a className="button small" href={item.download_url} target="_blank" rel="noreferrer">Consulter</a></article>)}
    </div>
  </section>;
}
