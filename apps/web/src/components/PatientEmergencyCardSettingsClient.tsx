"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { apiGet, apiPatch } from "../infrastructure/api/client";
import { EmergencyCardVisual } from "./emergency-card/EmergencyCardVisual";
import { downloadEmergencyCardPng } from "./emergency-card/emergency-card-image";
import { useConfirm } from "./modal/ConfirmProvider";
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

/* « Ma carte d’urgence » : la carte, son QR (unique, statique, pliable) et le téléchargement.
   Rien ne se modifie ici : ville, contact d’urgence, groupe sanguin et allergies sont des déclarations du carnet. */
export function PatientEmergencyCardSettingsClient() {
  const account = useSpaceAccount();
  const [card, setCard] = useState<EmergencyCard>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [message, setMessage] = useState("");
  const qrPanelId = useId();
  const confirm = useConfirm();

  useEffect(() => {
    let active = true;
    apiGet<EmergencyCard>("/api/v1/patient/emergency-card/")
      .then((data) => { if (active) setCard(data); })
      .catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : "Carte d’urgence indisponible."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function enableQr() {
    const ok = await confirm({ title: "Activer le QR d’urgence ?", message: "Toute personne qui scanne ce QR pourra consulter les informations de cette carte, sans se connecter.", note: "Le nom, le prénom, la ville, le groupe sanguin, les allergies, les traitements déclarés et le contact d’urgence seront visibles. Le QR ne change jamais et se met à jour tout seul avec votre carnet ; vous pouvez le désactiver à tout moment. Utilisez uniquement les informations dont vous avez la maîtrise.", confirmLabel: "Activer le QR", cancelLabel: "Pas maintenant", mood: "decision", tone: "neutral" });
    if (!ok) return;
    setSaving(true);
    try { setCard(await apiPatch<EmergencyCard>("/api/v1/patient/emergency-card/", { qr_enabled: true })); setQrOpen(true); setMessage("QR d’urgence activé."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Activation impossible."); }
    finally { setSaving(false); }
  }

  async function disableQr() {
    const ok = await confirm({ title: "Désactiver le QR d’urgence ?", message: "Le QR cessera immédiatement de donner accès à la carte.", note: "Vous pourrez le réactiver plus tard : ce sera exactement le même QR, inutile de le repartager.", confirmLabel: "Désactiver le QR", cancelLabel: "Garder le QR", mood: "question", tone: "danger" });
    if (!ok) return;
    setSaving(true);
    try { setCard(await apiPatch<EmergencyCard>("/api/v1/patient/emergency-card/", { qr_enabled: false })); setQrOpen(false); setMessage("QR désactivé : il ne donne plus accès à la carte."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Désactivation impossible."); }
    finally { setSaving(false); }
  }

  const publicUrl = card.qr_enabled && card.qr_token && typeof window !== "undefined"
    ? `${window.location.origin}/urgence/${encodeURIComponent(card.qr_token)}` : "";
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
      <h2 id="emergency-card-title">Ma carte virtuelle</h2>
      <p className="muted">Une personne qui scanne votre QR voit cette carte, sans se connecter. Elle se met à jour toute seule quand vous modifiez votre carnet.</p>
    </div>

    {loading ? <p className="notice" role="status">Chargement de la carte…</p> : <>
      <EmergencyCardVisual card={card} showQr={false} photo={photo} />

      <div className="ecard-panel__actions">
        <button type="button" className="button primary" disabled={saving || exporting} onClick={() => void downloadPng()}><Icon name="download" />{exporting ? "Création de l’image…" : "Télécharger en PNG"}</button>
        <Link className="button" href="/patient/carnet#carte-urgence">Modifier ma carte</Link>
      </div>

      <div className="ecard-qr">
        {card.qr_enabled && publicUrl
          ? <>
            <button type="button" className="ecard-qr__toggle" aria-expanded={qrOpen} aria-controls={qrPanelId} onClick={() => setQrOpen((open) => !open)}>
              <span>{qrOpen ? "Masquer mon QR" : "Afficher mon QR"}</span><Icon name="chevron" size={18} />
            </button>
            <div className="ecard-qr__panel" id={qrPanelId} data-open={qrOpen} role="region" aria-label="QR de ma carte d’urgence" inert={!qrOpen}>
              <div>
                <div className="ecard-qr__inner">
                  <div className="ecard-qr__box"><QRCodeSVG value={publicUrl} size={220} level="M" marginSize={2} title="QR de la carte d’urgence" /></div>
                  <p>Ce QR est le vôtre, toujours le même : il affiche votre carte à jour. Faites-le scanner en cas d’urgence.</p>
                  <button type="button" className="button small" disabled={saving} onClick={() => void disableQr()}>Désactiver le QR</button>
                </div>
              </div>
            </div>
          </>
          : <div className="ecard-qr__off">
            <p className="muted">Le QR est désactivé : personne ne peut ouvrir votre carte en le scannant. Il reste le même quand vous l’activez.</p>
            <button type="button" className="button" disabled={saving} onClick={() => void enableQr()}>{saving ? "Activation…" : "Activer mon QR"}</button>
          </div>}
      </div>

      <p className="ecard-panel__message" role="status" aria-live="polite">{message}</p>
      <p className="ecard-panel__hint">Cette carte ne remplace ni un avis médical ni les services de secours.</p>
    </>}
  </section>;
}
