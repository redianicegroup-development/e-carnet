"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { apiGet, apiPatch } from "../infrastructure/api/client";
import type { SpaceAccount } from "./shell/SpaceShell";
import { useConfirm } from "./modal/ConfirmProvider";
import { DossierCard, DossierRows, type DossierRow, type DossierTile } from "./DossierCard";
import { CollapsibleSection } from "./ui/CollapsibleSection";
import { VirtualCardPanel } from "./emergency-card/VirtualCardPanel";
import { emergencyCardProfessionLabel } from "./emergency-card/EmergencyCardVisual";
import { useEmergencyCard, useOwnProfession, type EmergencyCardData } from "./emergency-card/useEmergencyCard";
import { ageLabel } from "../lib/age";
import "./patient-sections.css";

type Profile = { first_name: string; last_name: string; birth_date: string | null; gender: string; phone: string; address: string; coverage_provider: string; coverage_number: string; coverage_expiry: string | null };
type Declaration = { id: string; kind: string; label: string; details: string; provenance?: { label: string } };
const GENDERS: Record<string, string> = { female: "Femme", male: "Homme", other: "Autre", prefer_not_to_say: "Préfère ne pas préciser" };
const KIND_LABELS: Record<string, string> = { allergy: "Allergie", antecedent: "Antécédent", treatment: "Traitement", blood_group: "Groupe sanguin", city: "Ville", emergency_contact: "Contact d’urgence", height: "Taille", weight: "Poids" };

/* « Dossier patient » : même présentation que le « Dossier médecin » (composant DossierCard : photo, nom en titre, informations en lignes ; lecture seule, on modifie dans les paramètres).
   Les informations restent celles du dossier patient : âge, genre, ville, téléphone, adresse, couverture santé, puis les autres déclarations avec leur provenance.
   Il porte aussi la carte virtuelle (avec le métier si le titulaire est un professionnel) et le QR de cette carte : une seule section d'accueil. */
export function PatientHomeIdentity({ account }: { account: SpaceAccount }) {
  const confirm = useConfirm();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [declarations, setDeclarations] = useState<Declaration[] | null>(null);
  const [profileMessage, setProfileMessage] = useState("");
  const { card, setCard, loading: cardLoading, error: cardError } = useEmergencyCard();
  const profession = useOwnProfession(account);
  const [qrBusy, setQrBusy] = useState(false);
  const [qrMessage, setQrMessage] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      apiGet<Profile>("/api/v1/patient/profile/"),
      apiGet<Declaration[]>("/api/v1/patient/declarations/"),
    ]).then(([nextProfile, nextDeclarations]) => {
      if (active) { setProfile(nextProfile); setDeclarations(nextDeclarations); }
    }).catch((error: unknown) => {
      if (active) setProfileMessage(error instanceof Error ? error.message : "Informations du profil indisponibles.");
    });
    return () => { active = false; };
  }, []);

  const city = declarations?.find((item) => item.kind === "city")?.label ?? "";
  const age = ageLabel(profile?.birth_date);
  const declared = (declarations ?? []).filter((item) => item.kind !== "city");
  const publicUrl = card.qr_enabled && card.qr_token && typeof window !== "undefined"
    ? `${window.location.origin}/urgence/${encodeURIComponent(card.qr_token)}` : "";
  const role = emergencyCardProfessionLabel(profession);
  const identityRows: DossierRow[] = [
    { label: "Âge", value: age || "Non renseigné" },
    { label: "Genre déclaré", value: profile?.gender ? GENDERS[profile.gender] ?? profile.gender : "Non renseigné" },
    { label: "Ville", value: city || "Non renseignée" },
    ...(profile?.phone ? [{ label: "Téléphone", value: profile.phone }] : []),
    ...(profile?.address ? [{ label: "Adresse", value: profile.address, wide: true }] : []),
  ];
  const coverageRows: DossierRow[] = [
    ...(profile?.coverage_provider ? [{ label: "Organisme", value: profile.coverage_provider }] : []),
    ...(profile?.coverage_number ? [{ label: "Numéro", value: profile.coverage_number }] : []),
    ...(profile?.coverage_expiry ? [{ label: "Expiration", value: new Date(`${profile.coverage_expiry.slice(0, 10)}T00:00:00`).toLocaleDateString("fr-FR") }] : []),
  ];
  const declaredRows: DossierRow[] = declared.map((item) => ({
    label: KIND_LABELS[item.kind] ?? item.kind,
    value: <>
      <span>{item.label}{item.kind === "height" ? " cm" : item.kind === "weight" ? " kg" : ""}</span>
      {item.details && <small className="dossier__details">{item.details}</small>}
      <span className="badge declared">{item.provenance?.label ?? "Déclaré par vous"}</span>
    </>,
  }));
  // Tout ce que le patient a déclaré : en tuiles pliables carrées. Les champs sont ceux du dossier patient d'origine.
  const tiles: DossierTile[] = [
    { key: "identity", title: "Identité et contact", icon: "user", hint: "Âge, genre, ville", content: <DossierRows rows={identityRows} /> },
    ...(coverageRows.length > 0 ? [{ key: "coverage", title: "Couverture santé", icon: "shield" as const, hint: "Organisme, numéro", content: <DossierRows rows={coverageRows} /> }] : []),
    { key: "declared", title: "Mes autres déclarations", icon: "pencil", hint: "Allergies, antécédents…", content: declarations === null ? <p className="muted">Chargement des déclarations…</p> : declared.length === 0 ? <p className="muted">Aucune autre déclaration enregistrée pour le moment.</p> : <DossierRows rows={declaredRows} /> },
  ];

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
      setCard(await apiPatch<EmergencyCardData>("/api/v1/patient/emergency-card/", { qr_enabled: enable }));
      setQrMessage(enable ? "QR activé." : "QR désactivé.");
    } catch (error) {
      setQrMessage(error instanceof Error ? error.message : "Impossible de modifier le QR.");
    } finally { setQrBusy(false); }
  }

  return <>
    <DossierCard
      account={account} eyebrow="Dossier patient" titleId="home-profile-title" role={role || undefined} tiles={tiles} className="patient-dossier"
      note="Informations déclarées par vous : Mon E‑Carnet ne les certifie pas."
      actions={<><Link className="button" href="/patient/parametres">Modifier mon profil</Link><Link className="button" href="/patient/carnet">Gérer mes déclarations</Link></>}
    >
      {profileMessage && <p className="notice" role="status">{profileMessage}</p>}
    </DossierCard>
    {/* Carte virtuelle et son QR : un bloc à part, tuile pliable comme celles du carnet. */}
    <div className="section-grid">
      <CollapsibleSection title="Ma carte virtuelle" icon="idcard" hint="Carte et QR">
        <VirtualCardPanel account={account} card={card} profession={profession} loading={cardLoading} error={cardError}>
          <aside className="patient-dossier__qr" aria-labelledby="home-qr-title">
            <h3 id="home-qr-title">QR de ma carte</h3>
            <p className="muted">Une personne qui scanne ce QR voit votre carte virtuelle, sans se connecter.</p>
            {cardLoading ? <p className="notice" role="status">Chargement du QR…</p> : publicUrl ? <>
              <div className="patient-dossier__qr-code"><QRCodeSVG value={publicUrl} size={168} level="M" marginSize={3} title="QR de ma carte virtuelle" /></div>
              <button className="button small" type="button" disabled={qrBusy} onClick={() => void toggleQr(false)}>{qrBusy ? "Mise à jour…" : "Désactiver le QR"}</button>
            </> : <>
              <p className="patient-dossier__qr-off">Le QR est désactivé.</p>
              <button className="button primary" type="button" disabled={qrBusy} onClick={() => void toggleQr(true)}>{qrBusy ? "Activation…" : "Activer mon QR"}</button>
            </>}
            {qrMessage && <p className="notice" role="status" aria-live="polite">{qrMessage}</p>}
            <p className="patient-dossier__qr-hint">Pour autoriser un professionnel en consultation, c’est un autre QR, valable 5 minutes : <Link href="/patient/consultations#preparer">étape 2 des consultations</Link>.</p>
          </aside>
        </VirtualCardPanel>
      </CollapsibleSection>
    </div>
  </>;
}
