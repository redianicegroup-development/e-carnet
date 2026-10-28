"use client";

import { useState, type ReactNode } from "react";
import { EmergencyCardVisual, type EmergencyCardProfession } from "./EmergencyCardVisual";
import { downloadEmergencyCardPng } from "./emergency-card-image";
import type { EmergencyCardData } from "./useEmergencyCard";
import { initials, type SpaceAccount } from "../shell/SpaceShell";
import { Icon } from "../ui/Icon";
import "./emergency-card.css";

/* « Ma carte virtuelle » : la carte (avec le métier pour un professionnel) et son téléchargement en image PNG.
   Même carte, même image dans l'espace patient et dans l'espace professionnel. `children` : blocs propres à l'espace (le QR, côté patient). */
export function VirtualCardPanel({ account, card, profession, loading, error, children }: { account: SpaceAccount; card: EmergencyCardData; profession?: EmergencyCardProfession | null; loading: boolean; error?: string; children?: ReactNode }) {
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");
  const view = { ...card, profession: profession ?? null };
  const photo = { url: account.avatar_url || undefined, initials: initials(account) };

  async function downloadPng() {
    setExporting(true);
    setMessage("");
    try {
      await downloadEmergencyCardPng(view, photo);
      setMessage("Carte enregistrée en image PNG. Elle montre vos informations : ne la partagez qu’avec des personnes de confiance.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "L’image n’a pas pu être créée.");
    } finally { setExporting(false); }
  }

  return <div className="virtual-card">
    <div><span className="eyebrow">Carte virtuelle</span><h3 className="virtual-card__title">Ma carte virtuelle</h3></div>
    {loading ? <p className="notice" role="status">Chargement de la carte…</p> : error ? <p className="notice" role="alert">{error}</p> : <>
      <EmergencyCardVisual card={view} showQr={false} photo={photo} />
      <div className="ecard-panel__actions">
        <button type="button" className="button primary" disabled={exporting} onClick={() => void downloadPng()}><Icon name="download" />{exporting ? "Création de l’image…" : "Télécharger en PNG"}</button>
      </div>
      <p className="ecard-panel__message" role="status" aria-live="polite">{message}</p>
    </>}
    {children}
  </div>;
}
