"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import { apiGet, apiPatch, apiPost } from "../infrastructure/api/client";
import { EmergencyCardVisual } from "./emergency-card/EmergencyCardVisual";
import { downloadEmergencyCardPng } from "./emergency-card/emergency-card-image";
import { useConfirm } from "./modal/ConfirmProvider";
import { Icon } from "./ui/Icon";

type EmergencyCard = {
  first_name: string;
  last_name: string;
  city: string;
  blood_group: string;
  allergies: { label: string; details: string }[];
  treatments: { label: string; details: string }[];
  contact_name: string;
  contact_phone: string;
  qr_enabled: boolean;
  qr_token: string;
  offline_declaration_ids: string[];
  offline_options: { id: string; kind: "allergy" | "treatment"; label: string; details: string }[];
  updated_at: string;
};
type OfflineCard = {
  first_name: string;
  last_name: string;
  birth_date: string;
  allergies: { label: string; details: string }[];
  treatments: { label: string; details: string }[];
  contact_name: string;
  contact_phone: string;
  updated_at: string;
  generated_at: string;
  may_be_outdated: boolean;
};
const EMPTY: EmergencyCard = { first_name: "", last_name: "", city: "", blood_group: "", allergies: [], treatments: [], contact_name: "", contact_phone: "", qr_enabled: false, qr_token: "", offline_declaration_ids: [], offline_options: [], updated_at: "" };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

export function PatientEmergencyCardSettingsClient() {
  const [card, setCard] = useState<EmergencyCard>(EMPTY);
  const [savedOfflineDeclarationIds, setSavedOfflineDeclarationIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [city, setCity] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [message, setMessage] = useState("");
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const confirm = useConfirm();

  function applyDetails(data: EmergencyCard) {
    setCity(data.city ?? ""); setContactName(data.contact_name ?? ""); setContactPhone(data.contact_phone ?? "");
  }

  useEffect(() => {
    let active = true;
    apiGet<EmergencyCard>("/api/v1/patient/emergency-card/")
      .then((data) => { if (active) { setCard(data); setSavedOfflineDeclarationIds(data.offline_declaration_ids); applyDetails(data); } })
      .catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : "Carte d’urgence indisponible."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function saveDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const updated = await apiPatch<EmergencyCard>("/api/v1/patient/emergency-card/", { city: city.trim(), contact_name: contactName.trim(), contact_phone: contactPhone.trim() });
      setCard(updated);
      applyDetails(updated);
      setEditing(false);
      setMessage(updated.qr_enabled ? "Carte mise à jour. Le QR affiche déjà ces nouvelles informations ; retéléchargez l’image si vous en avez une copie." : "Carte mise à jour.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Enregistrement impossible."); }
    finally { setSaving(false); }
  }

  async function enableQr() {
    const ok = await confirm({ title: "Activer le QR d’urgence ?", message: "Toute personne qui possède une copie de ce QR pourra consulter les informations de cette carte, sans se connecter.", note: "Le nom, le prénom, la ville, le groupe sanguin, les allergies, les traitements déclarés et le contact d’urgence seront visibles. Vous pourrez désactiver ou renouveler le QR à tout moment. Utilisez uniquement des données fictives dans cette version pilote.", confirmLabel: "Activer le QR", cancelLabel: "Pas maintenant", mood: "decision", tone: "neutral" });
    if (!ok) return;
    setSaving(true);
    try { setCard(await apiPatch<EmergencyCard>("/api/v1/patient/emergency-card/", { qr_enabled: true })); setMessage("QR d’urgence activé. Vous pouvez télécharger la carte en image."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Activation impossible."); }
    finally { setSaving(false); }
  }

  async function disableQr() {
    const ok = await confirm({ title: "Désactiver le QR d’urgence ?", message: "Les QR déjà imprimés ou enregistrés ne donneront plus accès à la carte.", note: "Vous pourrez le réactiver plus tard : un nouveau QR sera alors à partager.", confirmLabel: "Désactiver le QR", cancelLabel: "Garder le QR", mood: "question", tone: "danger" });
    if (!ok) return;
    setSaving(true);
    try { setCard(await apiPatch<EmergencyCard>("/api/v1/patient/emergency-card/", { qr_enabled: false })); setMessage("QR désactivé : les anciens liens ne donnent plus accès à la carte."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Désactivation impossible."); }
    finally { setSaving(false); }
  }

  async function rotateQr() {
    const ok = await confirm({ title: "Renouveler le QR ?", message: "L’ancien QR cessera immédiatement de fonctionner.", note: "Il faudra retélécharger la carte et la partager de nouveau aux personnes de confiance.", confirmLabel: "Renouveler le QR", cancelLabel: "Annuler", mood: "decision", tone: "neutral" });
    if (!ok) return;
    setSaving(true);
    try { setCard(await apiPost<EmergencyCard>("/api/v1/patient/emergency-card/", {})); setMessage("QR renouvelé. L’ancien lien est révoqué : retéléchargez votre carte."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Renouvellement impossible."); }
    finally { setSaving(false); }
  }

  const publicUrl = card.qr_enabled && card.qr_token && typeof window !== "undefined"
    ? `${window.location.origin}/urgence/${encodeURIComponent(card.qr_token)}` : "";

  async function downloadPng() {
    const qrCanvas = qrCanvasRef.current;
    if (!qrCanvas || !publicUrl) return;
    setExporting(true);
    setMessage("");
    try {
      await downloadEmergencyCardPng(card, qrCanvas);
      setMessage("Carte enregistrée en image PNG. Elle contient votre QR : ne la partagez qu’avec des personnes de confiance.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "L’image n’a pas pu être générée.");
    } finally { setExporting(false); }
  }

  function toggleOfflineDeclaration(id: string) {
    setCard((current) => ({
      ...current,
      offline_declaration_ids: current.offline_declaration_ids.includes(id)
        ? current.offline_declaration_ids.filter((selected) => selected !== id)
        : [...current.offline_declaration_ids, id],
    }));
  }

  async function saveOfflineSelection() {
    setSaving(true);
    try {
      const updated = await apiPatch<EmergencyCard>("/api/v1/patient/emergency-card/", { offline_declaration_ids: card.offline_declaration_ids });
      setCard(updated);
      setSavedOfflineDeclarationIds(updated.offline_declaration_ids);
      setMessage("Sélection de la carte imprimable enregistrée.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally { setSaving(false); }
  }

  const hasUnsavedOfflineSelection = card.offline_declaration_ids.length !== savedOfflineDeclarationIds.length
    || card.offline_declaration_ids.some((id) => !savedOfflineDeclarationIds.includes(id));

  async function printOfflineCard() {
    if (hasUnsavedOfflineSelection) {
      setMessage("Enregistrez d’abord votre sélection avant de générer la carte.");
      return;
    }
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setMessage("Autorisez les fenêtres contextuelles pour imprimer ou enregistrer votre carte imprimable.");
      return;
    }
    setSaving(true);
    try {
      const offline = await apiGet<OfflineCard>("/api/v1/patient/emergency-card/offline/");
      const list = (items: OfflineCard["allergies"]) => items.length
        ? `<ul>${items.map((item) => `<li><strong>${escapeHtml(item.label)}</strong>${item.details ? ` — ${escapeHtml(item.details)}` : ""}</li>`).join("")}</ul>`
        : "<p>Non renseigné dans la sélection.</p>";
      const updated = new Date(offline.updated_at).toLocaleString("fr-FR");
      const generated = new Date(offline.generated_at).toLocaleString("fr-FR");
      printWindow.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Carte d’urgence imprimable</title><style>body{font:16px system-ui,sans-serif;max-width:760px;margin:40px auto;padding:24px;color:#173b35}h1{color:#145d50}section{border:1px solid #b5d7ca;border-radius:12px;padding:16px;margin:14px 0}small{color:#526761}.warning{background:#fff4d5;padding:14px;border-radius:10px}@media print{body{margin:0;padding:10mm}}</style></head><body><header><small>MON CARNET NUMÉRIQUE · CARTE D’URGENCE IMPRIMABLE</small><h1>${escapeHtml(`${offline.first_name} ${offline.last_name}`.trim() || "Identité non renseignée")}</h1><p>Date de naissance : ${escapeHtml(offline.birth_date || "Non renseignée")}</p></header><section><h2>Allergies sélectionnées</h2>${list(offline.allergies)}</section><section><h2>Traitements sélectionnés</h2>${list(offline.treatments)}</section><section><h2>Contact d’urgence</h2><p>${escapeHtml(offline.contact_name || "Non renseigné")}${offline.contact_phone ? ` · ${escapeHtml(offline.contact_phone)}` : ""}</p></section><p class="warning"><strong>Peut être périmée.</strong> Dernière mise à jour du dossier : ${escapeHtml(updated)}. Carte générée le ${escapeHtml(generated)}. Cette copie n’expire pas automatiquement et ne peut pas être effacée à distance une fois enregistrée ou imprimée. Vérifiez les informations auprès du titulaire.</p><script>window.addEventListener("load",()=>window.print())</script></body></html>`);
      printWindow.document.close();
      setMessage("Carte ouverte pour impression ou enregistrement PDF. Une copie déjà enregistrée ne peut pas être révoquée à distance.");
    } catch (error) {
      printWindow.close();
      setMessage(error instanceof Error ? error.message : "La carte imprimable n’a pas pu être générée.");
    } finally { setSaving(false); }
  }

  return <section className="card ecard-panel" aria-labelledby="emergency-card-title">
    <div className="ecard-panel__head">
      <span className="eyebrow">Carte d’urgence virtuelle</span>
      <h2 id="emergency-card-title">Ma carte d’urgence</h2>
      <p className="muted">Une personne qui scanne le QR voit cette carte, sans se connecter. Le QR reste désactivé tant que vous ne l’activez pas.</p>
    </div>

    {loading ? <p className="notice" role="status">Chargement de la carte…</p> : <>
      <EmergencyCardVisual card={card} qrUrl={publicUrl} />

      <div className="ecard-panel__actions">
        {card.qr_enabled
          ? <>
            <button type="button" className="button primary" disabled={saving || exporting || !publicUrl} onClick={() => void downloadPng()}><Icon name="download" />{exporting ? "Création de l’image…" : "Télécharger en PNG"}</button>
            <button type="button" className="button" disabled={saving} onClick={() => void rotateQr()}>Renouveler le QR</button>
            <button type="button" className="button" disabled={saving} onClick={() => void disableQr()}>Désactiver le QR</button>
          </>
          : <button type="button" className="button primary" disabled={saving} onClick={() => void enableQr()}>{saving ? "Activation…" : "Activer mon QR"}</button>}
      </div>
      {card.qr_enabled
        ? <p className="ecard-panel__hint">L’image PNG contient votre QR : toute personne qui la possède peut afficher la carte. Si vous la perdez, renouvelez le QR.</p>
        : <p className="ecard-panel__hint">Activez le QR pour pouvoir télécharger la carte en image PNG (à garder sur votre téléphone ou à imprimer).</p>}
      <p className="ecard-panel__message" role="status" aria-live="polite">{message}</p>

      <div className="ecard-panel__links">
        <button type="button" className="ecard-panel__link" aria-expanded={editing} onClick={() => setEditing((value) => !value)}>{editing ? "Fermer la modification" : "Modifier la ville et le contact d’urgence"}</button>
        <Link className="ecard-panel__link" href="/patient/carnet">Modifier groupe sanguin et allergies (mon carnet)</Link>
      </div>

      {editing && <form className="ecard-edit" onSubmit={(event) => void saveDetails(event)} aria-label="Modifier la carte d’urgence">
        <div className="ecard-edit__grid">
          <label className="field"><span>Ville</span><input name="city" autoComplete="address-level2" maxLength={120} value={city} onChange={(event) => setCity(event.target.value)} disabled={saving} placeholder="Abidjan" /></label>
          <label className="field"><span>Nom du contact d’urgence</span><input name="contact_name" autoComplete="off" maxLength={120} value={contactName} onChange={(event) => setContactName(event.target.value)} disabled={saving} /></label>
          <label className="field"><span>Téléphone du contact</span><input name="contact_phone" type="tel" autoComplete="off" inputMode="tel" maxLength={32} value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} disabled={saving} /></label>
        </div>
        <p className="ecard-edit__note">Votre nom et votre prénom viennent de votre compte. Le groupe sanguin et les allergies viennent de vos déclarations du carnet.</p>
        <div className="actions">
          <button className="button primary" type="submit" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</button>
          <button className="button" type="button" disabled={saving} onClick={() => { applyDetails(card); setEditing(false); }}>Annuler</button>
        </div>
      </form>}

      <details className="ecard-details">
        <summary>Carte imprimable (sans QR, pour le portefeuille)</summary>
        <div className="ecard-details__body">
          <p className="muted">Document distinct du carnet complet : identité minimale, date de naissance et contact d’urgence, plus les allergies et traitements que vous choisissez ci-dessous.</p>
          {card.offline_options.length ? <fieldset className="ecard-offline__options">
            <legend>Informations déclaratives à inclure</legend>
            {card.offline_options.map((item) => <label key={item.id}><input type="checkbox" checked={card.offline_declaration_ids.includes(item.id)} onChange={() => toggleOfflineDeclaration(item.id)} disabled={saving} /><span>{item.kind === "allergy" ? "Allergie" : "Traitement"} : {item.label}</span></label>)}
          </fieldset> : <p className="muted">Aucune allergie ni aucun traitement déclaré à sélectionner.</p>}
          <p className="muted">Mise à jour du dossier : {card.updated_at ? new Date(card.updated_at).toLocaleString("fr-FR") : "—"}.</p>
          <div className="actions">
            <button type="button" className="button small" onClick={() => void saveOfflineSelection()} disabled={saving || !hasUnsavedOfflineSelection}>{saving ? "Enregistrement…" : "Enregistrer la sélection"}</button>
            <button type="button" className="button small" onClick={() => void printOfflineCard()} disabled={saving || hasUnsavedOfflineSelection}>{saving ? "Préparation…" : "Générer / imprimer"}</button>
          </div>
          <p className="ecard-panel__hint">La carte indique qu’elle peut être périmée. Une copie imprimée ou enregistrée ne peut pas être effacée ou révoquée à distance.</p>
        </div>
      </details>

      <p className="ecard-panel__hint">Version pilote : données fictives uniquement. Cette carte ne remplace ni un avis médical ni les services de secours.</p>
    </>}

    {publicUrl && <QRCodeCanvas ref={qrCanvasRef} value={publicUrl} size={468} level="M" marginSize={4} style={{ display: "none" }} aria-hidden="true" />}
  </section>;
}
