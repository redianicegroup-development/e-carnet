"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPatch } from "../infrastructure/api/client";
import type { PrescriptionSheetData } from "../lib/care-records";
import { PrescriptionSheet } from "./prescription/PrescriptionSheet";
import { useSealImage } from "./useSealImage";

/** Le modèle d'ordonnance ne garde que l'en-tête et le pied de page : tout le reste (logo, nom, type, adresse, téléphone, e-mail, cachet, signature)
    est lu sur la fiche de l'établissement et suit donc chaque modification de « Informations administratives » et de « Coordonnées ». */
type Template = { header_text: string; footer_text: string; updated_at: string };
const EMPTY: Template = { header_text: "", footer_text: "", updated_at: "" };

/** Ce que la fiche de l'établissement dit déjà : l'aperçu et l'ordonnance le reprennent tel quel. */
export type TemplateIdentity = { name: string; type?: string; city?: string; address?: string; phone?: string; email?: string; logo?: string };

/** L'en-tête dépend de la structure (publique, privée ou autre) : l'exemple proposé s'adapte à son type. Simple suggestion, jamais enregistrée. */
export function headerExample(type: string | undefined): string {
  switch (type) {
    case "Hôpital":
    case "Centre de santé":
      return "Ex. : Ministère de tutelle · Direction régionale · Service (structure publique) — ou spécialités et agrément (structure privée)";
    case "Clinique":
    case "Cabinet médical":
      return "Ex. : Spécialités, slogan, agrément";
    default:
      return "Ex. : informations utiles à afficher en haut de l’ordonnance";
  }
}

/** Contenu d'exemple de l'aperçu : il montre où va chaque champ, il ne ressemble à aucun patient réel. */
function sampleSheet(form: Template, identity: TemplateIdentity | undefined, today: string): PrescriptionSheetData {
  return {
    consultation_id: "sample",
    reference: "A1B2C3D4",
    issued_on: today,
    signed_at: null,
    establishment: {
      name: identity?.name || "Votre établissement",
      type: identity?.type || "",
      city: identity?.city || "",
      address: identity?.address || "",
      phone: identity?.phone || "",
      email: identity?.email || "",
      logo_url: identity?.logo || "",
      header_text: form.header_text,
      footer_text: form.footer_text,
    },
    prescriber: { name: "Dr Prénom Nom", title: "Médecin", specialty: "Médecine générale", order_number: "" },
    patient: { name: "Prénom NOM" },
    lines: [
      { id: "s1", drug_name: "Médicament A", dosage: "1 g", posology: "1 comprimé × 3 par jour", duration: "5 jours", instructions: "Conseil de prise (exemple)." },
      { id: "s2", drug_name: "Médicament B", dosage: "500 mg", posology: "1 comprimé le matin", duration: "10 jours", instructions: "" },
    ],
    has_signature: false,
    has_stamp: false,
    has_establishment_stamp: false,
    has_establishment_signature: false,
  };
}

export function PrescriptionTemplateSettings({ establishmentId, identity }: { establishmentId: string; identity?: TemplateIdentity }) {
  const [form, setForm] = useState<Template>(EMPTY);
  const [message, setMessage] = useState("Chargement du modèle…");
  const [busy, setBusy] = useState(false);
  const [marks, setMarks] = useState({ stamp_uploaded: false, signature_uploaded: false });
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  // Cachet et signature déposés dans « Informations administratives » : l'aperçu les montre tels qu'ils seront sur l'ordonnance (route privée de l'administrateur).
  const endpoint = `/api/v1/establishments/${establishmentId}/credentials`;
  const stampSrc = useSealImage("stamp", marks.stamp_uploaded, 0, endpoint);
  const signatureSrc = useSealImage("signature", marks.signature_uploaded, 0, endpoint);

  useEffect(() => {
    let active = true;
    apiGet<Template>(`/api/v1/establishments/${establishmentId}/prescription-template/`)
      .then((data) => { if (active) { setForm({ header_text: data.header_text ?? "", footer_text: data.footer_text ?? "", updated_at: data.updated_at ?? "" }); setMessage(""); } })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "Modèle indisponible."); });
    apiGet<{ stamp_uploaded: boolean; signature_uploaded: boolean }>(`${endpoint}/`)
      .then((data) => { if (active) setMarks(data); })
      .catch(() => undefined); // l'aperçu se contente alors du cachet électronique
    return () => { active = false; };
  }, [establishmentId, endpoint]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const saved = await apiPatch<Template>(`/api/v1/establishments/${establishmentId}/prescription-template/`, { header_text: form.header_text, footer_text: form.footer_text });
      setForm({ header_text: saved.header_text ?? "", footer_text: saved.footer_text ?? "", updated_at: saved.updated_at ?? "" });
      setMessage("Modèle d’ordonnance enregistré. Il sera utilisé par les médecins de cet établissement.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  const sample = sampleSheet(form, identity, today);

  return (
    <form className="settings-modal-section" onSubmit={submit}>
      <span className="eyebrow">Ordonnance de l’établissement</span>
      <h3>Personnaliser le modèle imprimable</h3>
      <p className="muted">Seuls l’en-tête et le pied de page se règlent ici. Le logo, le nom, le type, l’adresse, le téléphone, l’e-mail, le cachet et la signature de l’établissement sont repris automatiquement de « Informations administratives » et de « Coordonnées » : le modèle se met à jour avec elles. Le médecin reste responsable du contenu et de la validation de chaque prescription.</p>

      <details className="rx-preview" open>
        <summary>Aperçu de l’ordonnance (se met à jour pendant la saisie)</summary>
        <PrescriptionSheet data={sample} sample establishmentStampSrc={stampSrc || null} establishmentSignatureSrc={signatureSrc || null} />
        <p className="muted">Sans scan du cachet de l’établissement, un cachet électronique est dessiné à partir de son nom et de sa ville. La signature et le cachet du médecin viennent de son profil.</p>
      </details>

      <label className="field"><span>En-tête</span><textarea maxLength={500} rows={3} value={form.header_text} onChange={(event) => setForm({ ...form, header_text: event.target.value })} placeholder={headerExample(identity?.type)} /></label>
      <label className="field"><span>Pied de page</span><textarea maxLength={500} rows={3} value={form.footer_text} onChange={(event) => setForm({ ...form, footer_text: event.target.value })} placeholder="Ex. : consignes, informations légales ou « Prière de revenir avec l’ordonnance »" /></label>
      <div className="actions"><button className="button primary" type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer le modèle"}</button></div>
      <p className="status" role="status" aria-live="polite">{message}</p>
    </form>
  );
}
