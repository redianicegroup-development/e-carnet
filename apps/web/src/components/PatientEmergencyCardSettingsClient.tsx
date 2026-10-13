"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { apiGet, apiPatch, apiPost } from "../infrastructure/api/client";
import { useConfirm } from "./modal/ConfirmProvider";

type EmergencyCard = {
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
const EMPTY: EmergencyCard = { blood_group: "", allergies: [], treatments: [], contact_name: "", contact_phone: "", qr_enabled: false, qr_token: "", offline_declaration_ids: [], offline_options: [], updated_at: "" };

export function PatientEmergencyCardSettingsClient() {
  const [card, setCard] = useState<EmergencyCard>(EMPTY);
  const [savedOfflineDeclarationIds, setSavedOfflineDeclarationIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingContact, setEditingContact] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [message, setMessage] = useState("");
  const confirm = useConfirm();

  useEffect(() => {
    let active = true;
    apiGet<EmergencyCard>("/api/v1/patient/emergency-card/")
      .then((data) => { if (active) { setCard(data); setSavedOfflineDeclarationIds(data.offline_declaration_ids); setContactName(data.contact_name); setContactPhone(data.contact_phone); } })
      .catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : "Carte d’urgence indisponible."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function saveContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const updated = await apiPatch<EmergencyCard>("/api/v1/patient/emergency-card/", { contact_name: contactName.trim(), contact_phone: contactPhone.trim() });
      setCard(updated);
      setEditingContact(false);
      setMessage("Contact à prévenir enregistré.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Enregistrement impossible."); }
    finally { setSaving(false); }
  }

  async function enableQr() {
    const ok = await confirm({ title: "Activer le QR d’urgence ?", message: "Toute personne qui possède une copie de ce QR pourra consulter les informations affichées sur cette carte, sans se connecter.", note: "Le groupe sanguin, les allergies, les traitements déclarés et le contact d’urgence seront visibles. Vous pourrez désactiver ou renouveler le QR à tout moment. Utilisez uniquement des données fictives dans cette version pilote.", confirmLabel: "Activer le QR", cancelLabel: "Pas maintenant", mood: "decision", tone: "neutral" });
    if (!ok) return;
    setSaving(true);
    try { setCard(await apiPatch<EmergencyCard>("/api/v1/patient/emergency-card/", { qr_enabled: true })); setMessage("QR d’urgence activé."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Activation impossible."); }
    finally { setSaving(false); }
  }

  async function disableQr() {
    setSaving(true);
    try { setCard(await apiPatch<EmergencyCard>("/api/v1/patient/emergency-card/", { qr_enabled: false })); setMessage("QR désactivé : les anciens liens ne donnent plus accès à la carte."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Désactivation impossible."); }
    finally { setSaving(false); }
  }

  async function rotateQr() {
    const ok = await confirm({ title: "Renouveler le QR ?", message: "L’ancien QR cessera immédiatement de fonctionner.", note: "Il faudra partager le nouveau QR aux personnes de confiance.", confirmLabel: "Renouveler le QR", cancelLabel: "Annuler", mood: "decision", tone: "neutral" });
    if (!ok) return;
    setSaving(true);
    try { setCard(await apiPost<EmergencyCard>("/api/v1/patient/emergency-card/", {})); setMessage("QR renouvelé. L’ancien lien est révoqué."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Renouvellement impossible."); }
    finally { setSaving(false); }
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
      const updated = await apiPatch<EmergencyCard>("/api/v1/patient/emergency-card/", {
        offline_declaration_ids: card.offline_declaration_ids,
      });
      setCard(updated);
      setSavedOfflineDeclarationIds(updated.offline_declaration_ids);
      setMessage("Sélection de la carte hors ligne enregistrée.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character] ?? character);
  }

  async function printOfflineCard() {
    if (hasUnsavedOfflineSelection) {
      setMessage("Enregistrez d’abord votre sélection avant de générer la carte.");
      return;
    }
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setMessage("Autorisez les fenêtres contextuelles pour imprimer ou enregistrer votre carte hors ligne.");
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
      printWindow.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Carte d’urgence hors ligne</title><style>body{font:16px system-ui,sans-serif;max-width:760px;margin:40px auto;padding:24px;color:#173b35}h1{color:#145d50}section{border:1px solid #b5d7ca;border-radius:12px;padding:16px;margin:14px 0}small{color:#526761}.warning{background:#fff4d5;padding:14px;border-radius:10px}@media print{body{margin:0;padding:10mm}}</style></head><body><header><small>MON CARNET NUMÉRIQUE · CARTE D’URGENCE HORS LIGNE</small><h1>${escapeHtml(`${offline.first_name} ${offline.last_name}`.trim() || "Identité non renseignée")}</h1><p>Date de naissance : ${escapeHtml(offline.birth_date || "Non renseignée")}</p></header><section><h2>Allergies sélectionnées</h2>${list(offline.allergies)}</section><section><h2>Traitements sélectionnés</h2>${list(offline.treatments)}</section><section><h2>Contact d’urgence</h2><p>${escapeHtml(offline.contact_name || "Non renseigné")}${offline.contact_phone ? ` · ${escapeHtml(offline.contact_phone)}` : ""}</p></section><p class="warning"><strong>Peut être périmée.</strong> Dernière mise à jour du dossier : ${escapeHtml(updated)}. Carte générée le ${escapeHtml(generated)}. Cette copie hors ligne n’expire pas automatiquement et ne peut pas être effacée à distance une fois enregistrée ou imprimée. Vérifiez les informations auprès du titulaire.</p><script>window.addEventListener("load",()=>window.print())</script></body></html>`);
      printWindow.document.close();
      setMessage("Carte ouverte pour impression ou enregistrement PDF. Une copie déjà enregistrée ne peut pas être révoquée à distance.");
    } catch (error) {
      printWindow.close();
      setMessage(error instanceof Error ? error.message : "La carte hors ligne n’a pas pu être générée.");
    } finally {
      setSaving(false);
    }
  }

  const hasUnsavedOfflineSelection = card.offline_declaration_ids.length !== savedOfflineDeclarationIds.length
    || card.offline_declaration_ids.some((id) => !savedOfflineDeclarationIds.includes(id));
  const publicUrl = card.qr_enabled && card.qr_token && typeof window !== "undefined"
    ? `${window.location.origin}/urgence/${encodeURIComponent(card.qr_token)}` : "";

  return <section className="emergency-settings-card" aria-labelledby="emergency-card-title">
    <div className="emergency-settings-card__main">
      <span className="eyebrow">Carte d’urgence virtuelle</span>
      <h3 id="emergency-card-title">Les informations utiles, accessibles par QR</h3>
      <p className="muted">Le QR est désactivé tant que vous ne l’activez pas. Il peut être révoqué ou renouvelé à tout moment.</p>
      {loading ? <p className="emergency-card-status" role="status">Chargement de la carte…</p> : <>
        <div className="emergency-card-summary">
          <div><span>Groupe sanguin</span><strong>{card.blood_group || "Non renseigné"}</strong></div>
          <div><span>Allergies</span><strong>{card.allergies.length ? card.allergies.map((item) => item.label).join(", ") : "Aucune déclaration"}</strong></div>
          <div><span>Traitements</span><strong>{card.treatments.length ? card.treatments.map((item) => item.label).join(", ") : "Aucun traitement déclaré"}</strong></div>
          <div><span>Contact à prévenir</span><strong>{card.contact_name || "À renseigner"}{card.contact_phone ? ` · ${card.contact_phone}` : ""}</strong></div>
        </div>
        {!editingContact ? <button type="button" className="emergency-card-link" onClick={() => setEditingContact(true)}>{card.contact_name ? "Modifier le contact d’urgence" : "Ajouter un contact d’urgence"}</button> : <form className="emergency-card-contact-form" onSubmit={(event) => void saveContact(event)}>
          <label className="field"><span>Nom du contact</span><input autoComplete="name" maxLength={120} value={contactName} onChange={(event) => setContactName(event.target.value)} disabled={saving} /></label>
          <label className="field"><span>Téléphone du contact</span><input autoComplete="tel" type="tel" maxLength={32} value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} disabled={saving} /></label>
          <div className="actions"><button className="button primary" type="submit" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer le contact"}</button><button className="button" type="button" disabled={saving} onClick={() => { setContactName(card.contact_name); setContactPhone(card.contact_phone); setEditingContact(false); }}>Annuler</button></div>
        </form>}
        <section className="emergency-offline-card" aria-labelledby="emergency-offline-title">
          <h4 id="emergency-offline-title">Carte d’urgence imprimable / hors ligne</h4>
          <p className="muted">Document distinct du carnet complet. L’identité minimale, la date de naissance et le contact seront inclus. Choisissez les allergies et traitements à afficher.</p>
          {card.offline_options.length ? <fieldset className="emergency-offline-card__options">
            <legend>Informations déclaratives à inclure</legend>
            {card.offline_options.map((item) => <label key={item.id}><input type="checkbox" checked={card.offline_declaration_ids.includes(item.id)} onChange={() => toggleOfflineDeclaration(item.id)} disabled={saving} /><span>{item.kind === "allergy" ? "Allergie" : "Traitement"} : {item.label}</span></label>)}
          </fieldset> : <p className="muted">Aucune allergie ou aucun traitement déclaré à sélectionner.</p>}
          <p className="muted">Mise à jour du dossier : {card.updated_at ? new Date(card.updated_at).toLocaleString("fr-FR") : "—"}.</p>
          <div className="actions">
            <button type="button" className="button small" onClick={() => void saveOfflineSelection()} disabled={saving || !hasUnsavedOfflineSelection}>{saving ? "Enregistrement…" : "Enregistrer la sélection"}</button>
            <button type="button" className="button small" onClick={() => void printOfflineCard()} disabled={saving || hasUnsavedOfflineSelection}>{saving ? "Préparation…" : "Générer / imprimer la carte"}</button>
          </div>
          <p className="emergency-card-disclaimer">La carte indique qu’elle peut être périmée. Une copie imprimée ou sauvegardée hors ligne ne peut pas être effacée ou révoquée à distance.</p>
        </section>
        <p className="emergency-card-disclaimer">Version pilote : données fictives uniquement. Cette carte ne remplace ni un avis médical ni les services de secours.</p>
        <p className="emergency-card-message" role="status" aria-live="polite">{message}</p>
      </>}
    </div>
    <div className="emergency-settings-card__qr">
      {card.qr_enabled && publicUrl ? <>
        <div className="emergency-card-qr-code"><QRCodeSVG value={publicUrl} size={148} level="M" includeMargin /></div>
        <strong>QR actif</strong>
        <span>Seules les données de la carte sont affichées.</span>
        <div className="emergency-card-qr-actions"><button type="button" className="button small" disabled={saving} onClick={() => void rotateQr()}>Renouveler</button><button type="button" className="button small" disabled={saving} onClick={() => void disableQr()}>Désactiver</button></div>
      </> : <>
        <span className="emergency-card-qr-placeholder" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM19 14h2M19 18v3M14 21h3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
        <strong>QR désactivé</strong>
        <span>Activez-le seulement si vous souhaitez partager ces informations.</span>
        {!loading && <button type="button" className="button primary" disabled={saving} onClick={() => void enableQr()}>{saving ? "Activation…" : "Activer mon QR"}</button>}
      </>}
    </div>
  </section>;
}
