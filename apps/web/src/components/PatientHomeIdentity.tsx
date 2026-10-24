"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { apiGet, apiPatch } from "../infrastructure/api/client";
import type { SpaceAccount } from "./shell/SpaceShell";
import { useConfirm } from "./modal/ConfirmProvider";
import "./patient-sections.css";

type Profile = { first_name: string; last_name: string; birth_date: string | null; gender: string; phone: string; address: string; coverage_provider: string; coverage_number: string; coverage_expiry: string | null };
type Declaration = { id: string; kind: string; label: string; details: string; provenance?: { label: string } };
type EmergencyQr = { qr_enabled: boolean; qr_token: string };
const EMPTY_QR: EmergencyQr = { qr_enabled: false, qr_token: "" };
const GENDERS: Record<string, string> = { female: "Femme", male: "Homme", other: "Autre", prefer_not_to_say: "Préfère ne pas préciser" };
const KIND_LABELS: Record<string, string> = { allergy: "Allergie", antecedent: "Antécédent", treatment: "Traitement", blood_group: "Groupe sanguin", city: "Ville", emergency_contact: "Contact d’urgence", height: "Taille", weight: "Poids" };

function ageFromBirthDate(value: string | null) {
  if (!value) return "";
  const birth = new Date(`${value.slice(0, 10)}T00:00:00`);
  const today = new Date();
  if (Number.isNaN(birth.getTime()) || birth > today) return "";
  let years = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) years -= 1;
  if (years >= 130) return "";
  if (years >= 1) return `${years} an${years > 1 ? "s" : ""}`;
  const months = (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth() - (today.getDate() < birth.getDate() ? 1 : 0);
  return months >= 1 ? `${months} mois` : "Moins d’un mois";
}

export function PatientHomeIdentity({ account }: { account: SpaceAccount }) {
  const confirm = useConfirm();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [declarations, setDeclarations] = useState<Declaration[] | null>(null);
  const [profileMessage, setProfileMessage] = useState("");
  const [qr, setQr] = useState<EmergencyQr>(EMPTY_QR);
  const [qrLoading, setQrLoading] = useState(true);
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

  useEffect(() => {
    let active = true;
    apiGet<EmergencyQr>("/api/v1/patient/emergency-card/")
      .then((data) => { if (active) setQr(data); })
      .catch((error: unknown) => { if (active) setQrMessage(error instanceof Error ? error.message : "QR indisponible."); })
      .finally(() => { if (active) setQrLoading(false); });
    return () => { active = false; };
  }, []);

  const city = declarations?.find((item) => item.kind === "city")?.label ?? "";
  const age = ageFromBirthDate(profile?.birth_date ?? null);
  const declared = (declarations ?? []).filter((item) => item.kind !== "city");
  const publicUrl = qr.qr_enabled && qr.qr_token && typeof window !== "undefined"
    ? `${window.location.origin}/urgence/${encodeURIComponent(qr.qr_token)}` : "";

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
      setQr(await apiPatch<EmergencyQr>("/api/v1/patient/emergency-card/", { qr_enabled: enable }));
      setQrMessage(enable ? "QR activé." : "QR désactivé.");
    } catch (error) {
      setQrMessage(error instanceof Error ? error.message : "Impossible de modifier le QR.");
    } finally { setQrBusy(false); }
  }

  return <section className="card patient-dossier" aria-labelledby="home-profile-title">
    <div className="section-heading"><div><span className="eyebrow">Mon carnet · identité</span><h2 id="home-profile-title">Mon identité et mes informations déclarées</h2></div></div>
    {profileMessage && <p className="notice" role="status">{profileMessage}</p>}
    <div className="patient-dossier__layout">
      <dl className="patient-dossier__facts">
        <div><dt>Prénom</dt><dd>{profile?.first_name || account.first_name || "Non renseigné"}</dd></div>
        <div><dt>Nom</dt><dd>{profile?.last_name || account.last_name || "Non renseigné"}</dd></div>
        <div><dt>Âge</dt><dd>{age || "Non renseigné"}</dd></div>
        <div><dt>Genre déclaré</dt><dd>{profile?.gender ? GENDERS[profile.gender] ?? profile.gender : "Non renseigné"}</dd></div>
        <div><dt>Ville</dt><dd>{city || "Non renseignée"}</dd></div>
        {profile?.phone && <div><dt>Téléphone</dt><dd>{profile.phone}</dd></div>}
        {profile?.address && <div className="patient-dossier__wide"><dt>Adresse</dt><dd>{profile.address}</dd></div>}
        {profile?.coverage_provider && <div><dt>Couverture santé · organisme</dt><dd>{profile.coverage_provider}</dd></div>}
        {profile?.coverage_number && <div><dt>Couverture santé · numéro</dt><dd>{profile.coverage_number}</dd></div>}
        {profile?.coverage_expiry && <div><dt>Couverture santé · expiration</dt><dd>{new Date(`${profile.coverage_expiry.slice(0, 10)}T00:00:00`).toLocaleDateString("fr-FR")}</dd></div>}
      </dl>

      <aside className="patient-dossier__qr" aria-labelledby="home-qr-title">
        <h3 id="home-qr-title">Ma carte virtuelle</h3>
        <p className="muted">Une personne qui scanne ce QR voit votre carte virtuelle, sans se connecter.</p>
        {qrLoading ? <p className="notice" role="status">Chargement du QR…</p> : publicUrl ? <>
          <div className="patient-dossier__qr-code"><QRCodeSVG value={publicUrl} size={168} level="M" marginSize={3} title="QR de ma carte virtuelle" /></div>
          <button className="button small" type="button" disabled={qrBusy} onClick={() => void toggleQr(false)}>{qrBusy ? "Mise à jour…" : "Désactiver le QR"}</button>
        </> : <>
          <p className="patient-dossier__qr-off">Le QR de votre carte virtuelle est désactivé.</p>
          <button className="button primary" type="button" disabled={qrBusy} onClick={() => void toggleQr(true)}>{qrBusy ? "Activation…" : "Activer mon QR"}</button>
        </>}
        {qrMessage && <p className="notice" role="status" aria-live="polite">{qrMessage}</p>}
        <p className="patient-dossier__qr-hint">Pour autoriser un professionnel en consultation, c’est un autre QR, valable 5 minutes : <Link href="/patient/acces#qr">accès temporaire</Link>.</p>
      </aside>

      <div className="patient-dossier__declared">
        <h3>Mes autres déclarations</h3>
        {declarations === null ? <p className="muted">Chargement des déclarations…</p> : declared.length === 0 ? <p className="muted">Aucune autre déclaration enregistrée pour le moment.</p> : (
          <ul>{declared.map((item) => <li key={item.id}>
            <span className="patient-dossier__kind">{KIND_LABELS[item.kind] ?? item.kind}</span>
            <strong className="patient-dossier__value">{item.label}{item.kind === "height" ? " cm" : item.kind === "weight" ? " kg" : ""}</strong>
            {item.details && <small className="patient-dossier__details">{item.details}</small>}
            <span className="badge declared">{item.provenance?.label ?? "Déclaré par vous"}</span>
          </li>)}</ul>
        )}
      </div>
    </div>
    <div className="actions"><Link className="button" href="/patient/carnet">Gérer mes déclarations</Link><Link className="button" href="/patient/parametres">Modifier mon profil</Link></div>
  </section>;
}
