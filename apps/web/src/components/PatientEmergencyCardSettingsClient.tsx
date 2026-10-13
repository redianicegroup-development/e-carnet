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
};
const EMPTY: EmergencyCard = { blood_group: "", allergies: [], treatments: [], contact_name: "", contact_phone: "", qr_enabled: false, qr_token: "" };

export function PatientEmergencyCardSettingsClient() {
  const [card, setCard] = useState<EmergencyCard>(EMPTY);
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
      .then((data) => { if (active) { setCard(data); setContactName(data.contact_name); setContactPhone(data.contact_phone); } })
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
