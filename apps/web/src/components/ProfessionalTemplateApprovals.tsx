"use client";
import { useEffect, useState } from "react";
import { apiGet, apiPost, ApiError } from "../infrastructure/api/client";
type TemplateField = { key: string; label: string; type: string; unit: string; required: boolean; options: string[] };
type Template = { id: string; name: string; status: string; fields: TemplateField[] };
export function ProfessionalTemplateApprovals() {
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    apiGet<Template[]>("/api/v1/patient/care/professional/preconsultation-templates/pending/").then((data) => { if (active) setItems(data); }).catch((cause) => { if (active && !(cause instanceof ApiError && cause.status === 403)) setError(cause instanceof Error ? cause.message : "Impossible de charger les validations en attente."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function approve(item: Template) {
    const fieldsSummary = item.fields.map((field) => `• ${field.label} (${field.type}${field.required ? ", obligatoire" : ""})`).join("\n");
    if (!window.confirm(`En validant, vous confirmez en tant que référent médical que « ${item.name} » et ses champs sont appropriés. Cette décision sera inscrite dans l’audit.\n\n${fieldsSummary}\n\nConfirmer ?`)) return;
    setBusyId(item.id); setError(""); setMessage("");
    try { await apiPost(`/api/v1/patient/care/professional/preconsultation-templates/${item.id}/approve/`, { confirm_medical_review: true }); setItems((current) => current.filter((row) => row.id !== item.id)); setMessage(`« ${item.name} » est maintenant actif après validation médicale.`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "La validation a échoué."); }
    finally { setBusyId(""); }
  }
  if (loading || (!items.length && !error && !message)) return null;
  return <section className="card stack" aria-labelledby="medical-template-approval-title"><div><h2 id="medical-template-approval-title">Modèles à valider</h2><p className="muted">Chaque activation est une confirmation médicale enregistrée.</p></div>{message && <p className="notice" role="status">{message}</p>}{error && <p className="notice" role="alert">{error}</p>}{items.map((item) => <article className="record" key={item.id}><div><strong>{item.name}</strong><ol>{item.fields.map((field) => <li key={field.key}>{field.label}{field.unit ? ` (${field.unit})` : ""} · {field.type}{field.required ? " · obligatoire" : ""}{field.options.length ? ` · ${field.options.join(", ")}` : ""}</li>)}</ol></div><button type="button" className="button primary" disabled={Boolean(busyId)} onClick={() => void approve(item)}>{busyId === item.id ? "Validation…" : "Confirmer la validation médicale"}</button></article>)}{!items.length && message && <p className="empty">Aucun autre modèle en attente.</p>}</section>;
}
