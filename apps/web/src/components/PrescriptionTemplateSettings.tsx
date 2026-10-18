"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPatch, apiUploadPatch } from "../infrastructure/api/client";

type Template = { logo_url: string; header_text: string; footer_text: string; phone: string; email: string; address: string; updated_at: string };
const EMPTY: Template = { logo_url: "", header_text: "", footer_text: "", phone: "", email: "", address: "", updated_at: "" };

export function PrescriptionTemplateSettings({ establishmentId }: { establishmentId: string }) {
  const [form, setForm] = useState<Template>(EMPTY);
  const [message, setMessage] = useState("Chargement du modèle…");
  const [busy, setBusy] = useState(false);
  const [logo, setLogo] = useState<File | null>(null);
  useEffect(() => { let active = true; apiGet<Template>(`/api/v1/establishments/${establishmentId}/prescription-template/`).then((data) => { if (active) { setForm(data); setMessage(""); } }).catch((error) => active && setMessage(error instanceof Error ? error.message : "Modèle indisponible.")); return () => { active = false; }; }, [establishmentId]);
  async function submit(event: React.FormEvent) { event.preventDefault(); setBusy(true); setMessage(""); try { let saved: Template; if (logo) { const multipart = new FormData(); Object.entries(form).forEach(([key, value]) => { if (key !== "updated_at") multipart.append(key, value); }); multipart.append("logo", logo); saved = await apiUploadPatch<Template>(`/api/v1/establishments/${establishmentId}/prescription-template/`, multipart); } else saved = await apiPatch<Template>(`/api/v1/establishments/${establishmentId}/prescription-template/`, form); setForm(saved); setLogo(null); setMessage("Modèle d’ordonnance enregistré. Il sera utilisé par les médecins de cet établissement."); } catch (error) { setMessage(error instanceof Error ? error.message : "Enregistrement impossible."); } finally { setBusy(false); } }
  return <form className="settings-modal-section" onSubmit={submit}><span className="eyebrow">Ordonnance de l’établissement</span><h3>Personnaliser le modèle imprimable</h3><p className="muted">Ces informations forment l’en-tête et le pied de page. Le médecin reste responsable du contenu et de la validation de chaque prescription.</p>
    <label className="field"><span>Logo de l’établissement (facultatif)</span><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => setLogo(event.target.files?.[0] ?? null)} /><small className="muted">PNG, JPG, WebP ou SVG — 5 Mo maximum. Le fichier est envoyé vers Cloudinary.</small></label>
    <label className="field"><span>En-tête</span><textarea maxLength={500} rows={3} value={form.header_text} onChange={(event) => setForm({ ...form, header_text: event.target.value })} placeholder="Spécialités, slogan ou informations utiles" /></label>
    <div className="patient-grid patient-grid--compact"><label className="field"><span>Adresse</span><input maxLength={240} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label><label className="field"><span>Téléphone</span><input maxLength={32} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label></div>
    <label className="field"><span>Email</span><input type="email" maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
    <label className="field"><span>Pied de page</span><textarea maxLength={500} rows={3} value={form.footer_text} onChange={(event) => setForm({ ...form, footer_text: event.target.value })} placeholder="Informations légales ou consignes" /></label>
    <div className="actions"><button className="button primary" type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer le modèle"}</button></div><p className="status" role="status" aria-live="polite">{message}</p>
  </form>;
}
