"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
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

/* « Ma carte d’urgence » (patient) ou « Ma carte professionnelle » (professionnel) : section de carte virtuelle repliable et téléchargement.
   Rien ne se modifie ici : ville, contact d’urgence, groupe sanguin et allergies sont des déclarations du carnet.
   Le QR public de la carte n'est plus proposé (décision produit 13/11/2026) : seul un QR déjà actif peut encore être désactivé, jamais activé. */
export function PatientEmergencyCardSettingsClient({ variant = "patient" }: { variant?: "patient" | "professional" }) {
  const professional = variant === "professional";
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
  async function disableQr() {
    const ok = await confirm({ title: "Désactiver le QR ?", message: "Le QR cessera immédiatement de donner accès à votre carte virtuelle.", note: "Il n’est plus possible de le réactiver.", confirmLabel: "Désactiver", cancelLabel: "Garder le QR", mood: "question", tone: "danger" });
    if (!ok) return;
    setQrBusy(true);
    setQrMessage("");
    try {
      setCard(await apiPatch<EmergencyCard>("/api/v1/patient/emergency-card/", { qr_enabled: false }));
      setQrMessage("QR désactivé.");
    } catch (error) {
      setQrMessage(error instanceof Error ? error.message : "Impossible de modifier le QR.");
    } finally { setQrBusy(false); }
  }

  return <section className="card ecard-panel" aria-labelledby="emergency-card-title">
    <div className="ecard-panel__head">
      <span className="eyebrow">{professional ? "Carte professionnelle" : "Carte d’urgence"}</span>
      <h2 id="emergency-card-title" className="ecard-panel__title"><button className="ecard-panel__toggle" type="button" aria-expanded={cardOpen} aria-controls={cardPanelId} onClick={() => setCardOpen((open) => !open)}>{professional ? "Ma carte professionnelle" : "Ma carte virtuelle"}<Icon name="chevron" size={20} /></button></h2>
      <p className="muted">{professional ? "Votre carte avec votre métier et votre spécialité. Vous pouvez la télécharger en image ; elle se met à jour quand vous modifiez votre profil." : "Votre carte d’urgence, avec la taille et le poids que vous avez déclarés. Elle se met à jour quand vous modifiez votre carnet."}</p>
    </div>

    {loading ? <p className="notice" role="status">Chargement de la carte…</p> : <>
      <div id={cardPanelId} className="ecard-panel__content" hidden={!cardOpen}>
      <EmergencyCardVisual card={shown} showQr={false} photo={photo} />

      <div className="ecard-panel__actions">
        <button type="button" className="button primary" disabled={exporting} onClick={() => void downloadPng()}><Icon name="download" />{exporting ? "Création de l’image…" : "Télécharger en PNG"}</button>
        <Link className="button" href={professional ? "/professionnel/onboarding?retour=parametres" : "/patient/carnet#carte-urgence"}>{professional ? "Modifier mon profil" : "Modifier ma carte"}</Link>
      </div>

      {publicUrl && <aside className="patient-dossier__qr" aria-labelledby="home-qr-title">
        <h3 id="home-qr-title">QR public encore actif</h3>
        <p className="muted">Le QR de la carte n’est plus proposé. Celui que vous aviez activé donne encore accès à votre carte sans connexion : désactivez-le.</p>
        <button className="button small" type="button" disabled={qrBusy} onClick={() => void disableQr()}>{qrBusy ? "Mise à jour…" : "Désactiver le QR"}</button>
        {qrMessage && <p className="notice" role="status" aria-live="polite">{qrMessage}</p>}
      </aside>}

      </div>
      <p className="ecard-panel__message" role="status" aria-live="polite">{message}</p>
      <p className="ecard-panel__hint">Cette carte ne remplace ni un avis médical ni les services de secours.</p>
    </>}
  </section>;
}
