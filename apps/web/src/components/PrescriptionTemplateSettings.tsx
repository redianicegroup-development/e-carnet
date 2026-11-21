"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPatch, apiUploadPatch } from "../infrastructure/api/client";
import type { PrescriptionSheetData } from "../lib/care-records";
import { PrescriptionSheet } from "./prescription/PrescriptionSheet";

type Template = { logo_url: string; header_text: string; footer_text: string; phone: string; email: string; address: string; updated_at: string };
const EMPTY: Template = { logo_url: "", header_text: "", footer_text: "", phone: "", email: "", address: "", updated_at: "" };

/** Ce que la fiche de l'établissement sait déjà : sert de repli à l'aperçu quand un champ du modèle est vide (le PDF et l'ordonnance font de même). */
export type TemplateIdentity = { name: string; type?: string; city?: string; address?: string; phone?: string; email?: string; logo?: string };

/** Contenu d'exemple de l'aperçu : il montre où va chaque champ, il ne ressemble à aucun patient réel. */
function sampleSheet(form: Template, identity: TemplateIdentity | undefined, logoSrc: string, today: string): PrescriptionSheetData {
  return {
    consultation_id: "sample",
    reference: "A1B2C3D4",
    issued_on: today,
    signed_at: null,
    establishment: {
      name: identity?.name || "Votre établissement",
      type: identity?.type || "",
      city: identity?.city || "",
      address: form.address || identity?.address || "",
      phone: form.phone || identity?.phone || "",
      email: form.email || identity?.email || "",
      logo_url: logoSrc || form.logo_url || identity?.logo || "",
      header_text: form.header_text,
      footer_text: form.footer_text,
    },
    prescriber: { name: "Dr Prénom Nom", title: "Médecin", specialty: "Médecine générale", order_number: "" },
    patient: { name: "Prénom NOM", age_years: 34, sex: "female", weight: "61 kg" },
    lines: [
      { id: "s1", drug_name: "Médicament A", dosage: "1 g", posology: "1 comprimé × 3 par jour", duration: "5 jours", instructions: "Conseil de prise (exemple)." },
      { id: "s2", drug_name: "Médicament B", dosage: "500 mg", posology: "1 comprimé le matin", duration: "10 jours", instructions: "" },
    ],
    next_appointment: null,
    has_signature: false,
    has_stamp: false,
  };
}

export function PrescriptionTemplateSettings({ establishmentId, identity }: { establishmentId: string; identity?: TemplateIdentity }) {
  const [form, setForm] = useState<Template>(EMPTY);
  const [message, setMessage] = useState("Chargement du modèle…");
  const [busy, setBusy] = useState(false);
  const [logo, setLogo] = useState<File | null>(null);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  // Aperçu du logo choisi avant même son envoi ; l'URL d'objet est révoquée dès que le fichier change ou que la fenêtre se ferme.
  const logoPreview = useMemo(() => (logo ? URL.createObjectURL(logo) : ""), [logo]);
  useEffect(() => () => { if (logoPreview) URL.revokeObjectURL(logoPreview); }, [logoPreview]);

  useEffect(() => {
    let active = true;
    apiGet<Template>(`/api/v1/establishments/${establishmentId}/prescription-template/`)
      .then((data) => { if (active) { setForm(data); setMessage(""); } })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "Modèle indisponible."); });
    return () => { active = false; };
  }, [establishmentId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      let saved: Template;
      if (logo) {
        const multipart = new FormData();
        Object.entries(form).forEach(([key, value]) => { if (key !== "updated_at") multipart.append(key, value); });
        multipart.append("logo", logo);
        saved = await apiUploadPatch<Template>(`/api/v1/establishments/${establishmentId}/prescription-template/`, multipart);
      } else {
        saved = await apiPatch<Template>(`/api/v1/establishments/${establishmentId}/prescription-template/`, form);
      }
      setForm(saved);
      setLogo(null);
      setMessage("Modèle d’ordonnance enregistré. Il sera utilisé par les médecins de cet établissement.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  const sample = sampleSheet(form, identity, logoPreview, today);

  return (
    <form className="settings-modal-section" onSubmit={submit}>
      <span className="eyebrow">Ordonnance de l’établissement</span>
      <h3>Personnaliser le modèle imprimable</h3>
      <p className="muted">Ces informations forment l’en-tête et le pied de page. Le médecin reste responsable du contenu et de la validation de chaque prescription.</p>

      <details className="rx-preview" open>
        <summary>Aperçu de l’ordonnance (se met à jour pendant la saisie)</summary>
        <PrescriptionSheet data={sample} sample />
        <p className="muted">Le cachet de l’établissement est généré automatiquement à partir de son nom et de sa ville. Le cachet et la signature du médecin viennent de son profil.</p>
      </details>

      <label className="field"><span>Logo de l’établissement (facultatif)</span><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => setLogo(event.target.files?.[0] ?? null)} /><small className="muted">PNG, JPG, WebP ou SVG — 5 Mo maximum. Sans logo, l’ordonnance affiche les initiales de l’établissement.</small></label>
      <label className="field"><span>En-tête</span><textarea maxLength={500} rows={3} value={form.header_text} onChange={(event) => setForm({ ...form, header_text: event.target.value })} placeholder="Spécialités, slogan ou informations utiles" /></label>
      <div className="patient-grid patient-grid--compact">
        <label className="field"><span>Adresse</span><input maxLength={240} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder={identity?.address || undefined} /></label>
        <label className="field"><span>Téléphone</span><input maxLength={32} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder={identity?.phone || undefined} /></label>
      </div>
      <label className="field"><span>Email</span><input type="email" maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder={identity?.email || undefined} /></label>
      <label className="field"><span>Pied de page</span><textarea maxLength={500} rows={3} value={form.footer_text} onChange={(event) => setForm({ ...form, footer_text: event.target.value })} placeholder="Informations légales ou consignes" /></label>
      <div className="actions"><button className="button primary" type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer le modèle"}</button></div>
      <p className="status" role="status" aria-live="polite">{message}</p>
    </form>
  );
}
