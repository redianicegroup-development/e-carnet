"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { apiGet, apiPatch } from "../infrastructure/api/client";
import { useConfirm } from "./modal/ConfirmProvider";
import "./patient-sections.css";
import { EmergencyCardVisual } from "./emergency-card/EmergencyCardVisual";
import { useOwnProfession } from "./emergency-card/useEmergencyCard";
import { downloadEmergencyCardPng } from "./emergency-card/emergency-card-image";
import { initials, useSpaceAccount } from "./shell/SpaceShell";
import { Icon } from "./ui/Icon";

type EmergencyCard = {
  first_name: string;
  last_name: string;
  city: string;
  blood_group: string;
  height_cm: string;
  weight_kg: string;
  allergies: { label: string; details: string }[];
  treatments: { label: string; details: string }[];
  contact_name: string;
  contact_phone: string;
  qr_enabled: boolean;
  qr_token: string;
  updated_at: string;
};
const EMPTY: EmergencyCard = { first_name: "", last_name: "", city: "", blood_group: "", height_cm: "", weight_kg: "", allergies: [], treatments: [], contact_name: "", contact_phone: "", qr_enabled: false, qr_token: "", updated_at: "" };

/* « Ma carte d’urgence » : section de carte virtuelle repliable et téléchargement.
   Rien ne se modifie ici : ville, contact d’urgence, groupe sanguin et allergies sont des déclarations du carnet. */
export function PatientEmergencyCardSettingsClient() {
  const account = useSpaceAccount();
  const [card, setCard] = useState<EmergencyCard>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [cardOpen, setCardOpen] = useState(true);
  const [message, setMessage] = useState("");
  const cardPanelId = useId();
  const confirm = useConfirm();
  const [qrBusy, setQrBusy] = useState(false);
  const [qrMessage, setQrMessage] = useState("");

  useEffect(() => {
    let active = true;
    apiGet<EmergencyCard>("/api/v1/patient/emergency-card/")
      .then((data) => { if (active) setCard(data); })
      .catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : "Carte d’urgence indisponible."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const profession = useOwnProfession(account);
  const shown = { ...card, profession };
  const photo = { url: account?.avatar_url || undefined, initials: account ? initials(account) : "?" };

  async function downloadPng() {
    setExporting(true);
    setMessage("");
    try {
      await downloadEmergencyCardPng(shown, photo);
      setMessage("Carte enregistrée en image PNG. Elle montre vos informations d’urgence : ne la partagez qu’avec des personnes de confiance.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "L’image n’a pas pu être générée.");
    } finally { setExporting(false); }
  }

  const publicUrl = card.qr_enabled && card.qr_token && typeof window !== "undefined" ? `${window.location.origin}/urgence/${encodeURIComponent(card.qr_token)}` : "";
  async function toggleQr(enable: boolean) {
    if (enable) {
      const ok = await confirm({ title: "Activer le QR de ma carte virtuelle ?", message: "Toute personne qui scanne ce QR pourra consulter la carte sans se connecter.", note: "La carte affiche notamment vos nom et prénom, ville, groupe sanguin, taille et poids déclarés, allergies, traitements déclarés et contact d’urgence. Le QR est stable et vous pouvez le désactiver à tout moment.", confirmLabel: "Activer le QR", cancelLabel: "Pas maintenant", mood: "decision", tone: "neutral" });
      if (!ok) return;
    } else {
      const ok = await confirm({ title: "Désactiver le QR ?", message: "Le QR cessera immédiatement de donner accès à votre carte virtuelle.", note: "Vous pourrez le réactiver plus tard avec le même QR.", confirmLabel: "Désactiver", cancelLabel: "Garder le QR", mood: "question", tone: "danger" });
      if (!ok) return;
    }
    setQrBusy(true);
    setQrMessage("");
    try {
      setCard(await apiPatch<EmergencyCard>("/api/v1/patient/emergency-card/", { qr_enabled: enable }));
      setQrMessage(enable ? "QR activé." : "QR désactivé.");
    } catch (error) {
      setQrMessage(error instanceof Error ? error.message : "Impossible de modifier le QR.");
    } finally { setQrBusy(false); }
  }

  return <section className="card ecard-panel" aria-labelledby="emergency-card-title">
    <div className="ecard-panel__head">
      <span className="eyebrow">Carte d’urgence</span>
      <h2 id="emergency-card-title" className="ecard-panel__title"><button className="ecard-panel__toggle" type="button" aria-expanded={cardOpen} aria-controls={cardPanelId} onClick={() => setCardOpen((open) => !open)}>Ma carte virtuelle<Icon name="chevron" size={20} /></button></h2>
      <p className="muted">Le QR public de cette carte se gère ici, sous la carte. Une personne qui le scanne voit cette carte sans se connecter, y compris la taille et le poids que vous avez déclarés ; elle se met à jour quand vous modifiez votre carnet.</p>
    </div>

    {loading ? <p className="notice" role="status">Chargement de la carte…</p> : <>
      <div id={cardPanelId} className="ecard-panel__content" hidden={!cardOpen}>
      <EmergencyCardVisual card={shown} showQr={false} photo={photo} />

      <div className="ecard-panel__actions">
        <button type="button" className="button primary" disabled={exporting} onClick={() => void downloadPng()}><Icon name="download" />{exporting ? "Création de l’image…" : "Télécharger en PNG"}</button>
        <Link className="button" href="/patient/carnet#carte-urgence">Modifier ma carte</Link>
      </div>

      <aside className="patient-dossier__qr" aria-labelledby="home-qr-title">
        <h3 id="home-qr-title">QR de ma carte</h3>
        <p className="muted">Une personne qui scanne ce QR voit votre carte virtuelle, sans se connecter.</p>
        {publicUrl ? <>
          <div className="patient-dossier__qr-code"><QRCodeSVG value={publicUrl} size={168} level="M" marginSize={3} title="QR de ma carte virtuelle" /></div>
          <button className="button small" type="button" disabled={qrBusy} onClick={() => void toggleQr(false)}>{qrBusy ? "Mise à jour…" : "Désactiver le QR"}</button>
        </> : <>
          <p className="patient-dossier__qr-off">Le QR est désactivé.</p>
          <button className="button primary" type="button" disabled={qrBusy} onClick={() => void toggleQr(true)}>{qrBusy ? "Activation…" : "Activer mon QR"}</button>
        </>}
        {qrMessage && <p className="notice" role="status" aria-live="polite">{qrMessage}</p>}
        <p className="patient-dossier__qr-hint">Pour autoriser un professionnel en consultation, c’est un autre QR, valable 5 minutes : <Link href="/patient/consultations#preparer">étape 2 des consultations</Link>.</p>
      </aside>

      </div>
      <p className="ecard-panel__message" role="status" aria-live="polite">{message}</p>
      <p className="ecard-panel__hint">Cette carte ne remplace ni un avis médical ni les services de secours.</p>
    </>}
  </section>;
}
