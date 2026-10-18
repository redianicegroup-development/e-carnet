"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { apiGet } from "../infrastructure/api/client";
import { EmergencyCardVisual } from "./emergency-card/EmergencyCardVisual";
import { downloadEmergencyCardPng } from "./emergency-card/emergency-card-image";
import { initials, useSpaceAccount } from "./shell/SpaceShell";
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
  updated_at: string;
};
const EMPTY: EmergencyCard = { first_name: "", last_name: "", city: "", blood_group: "", allergies: [], treatments: [], contact_name: "", contact_phone: "", qr_enabled: false, qr_token: "", updated_at: "" };

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

  useEffect(() => {
    let active = true;
    apiGet<EmergencyCard>("/api/v1/patient/emergency-card/")
      .then((data) => { if (active) setCard(data); })
      .catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : "Carte d’urgence indisponible."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const photo = { url: account?.avatar_url || undefined, initials: account ? initials(account) : "?" };

  async function downloadPng() {
    setExporting(true);
    setMessage("");
    try {
      await downloadEmergencyCardPng(card, photo);
      setMessage("Carte enregistrée en image PNG. Elle montre vos informations d’urgence : ne la partagez qu’avec des personnes de confiance.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "L’image n’a pas pu être générée.");
    } finally { setExporting(false); }
  }

  return <section className="card ecard-panel" aria-labelledby="emergency-card-title">
    <div className="ecard-panel__head">
      <span className="eyebrow">Carte d’urgence</span>
      <h2 id="emergency-card-title" className="ecard-panel__title"><button className="ecard-panel__toggle" type="button" aria-expanded={cardOpen} aria-controls={cardPanelId} onClick={() => setCardOpen((open) => !open)}>Ma carte virtuelle<Icon name="chevron" size={20} /></button></h2>
      <p className="muted">Le QR public de cette carte se trouve désormais dans votre carte compte/identité. Une personne qui le scanne voit cette carte sans se connecter ; elle se met à jour quand vous modifiez votre carnet.</p>
    </div>

    {loading ? <p className="notice" role="status">Chargement de la carte…</p> : <>
      <div id={cardPanelId} className="ecard-panel__content" hidden={!cardOpen}>
      <EmergencyCardVisual card={card} showQr={false} photo={photo} />

      <div className="ecard-panel__actions">
        <button type="button" className="button primary" disabled={exporting} onClick={() => void downloadPng()}><Icon name="download" />{exporting ? "Création de l’image…" : "Télécharger en PNG"}</button>
        <Link className="button" href="/patient/carnet#carte-urgence">Modifier ma carte</Link>
      </div>

      </div>
      <p className="ecard-panel__message" role="status" aria-live="polite">{message}</p>
      <p className="ecard-panel__hint">Cette carte ne remplace ni un avis médical ni les services de secours.</p>
    </>}
  </section>;
}
