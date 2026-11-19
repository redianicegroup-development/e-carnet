"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AvatarPicker } from "./AvatarPicker";
import { LinkedProvidersSettingsClient } from "./LinkedProvidersSettingsClient";
import { PatientHealthSettingsClient } from "./PatientHealthSettingsClient";
import { ProfileSummary, usePatientStats } from "./ProfileSummary";
import { SettingsDirectory, type SettingsNavItem } from "./SettingsDirectory";
import { SettingsModal } from "./SettingsModal";
import { NearbyEstablishments } from "./NearbyEstablishments";
import { SettingsMoreSection } from "./SettingsMoreSection";
import { LandingFeedbackWidget } from "./LandingFeedbackWidget";
import { ThemeSettingsClient } from "./ThemeSettingsClient";
import { AccountActionRequestsSettingsClient } from "./AccountActionRequestsSettingsClient";
import { PatientEmergencyCardSettingsClient } from "./PatientEmergencyCardSettingsClient";
import { PatientProfileSwitcher } from "./PatientProfileSwitcher";
import { PatientRepresentationsSettingsClient } from "./PatientRepresentationsSettingsClient";
import { usePatientProfiles } from "./usePatientProfiles";
import { TrustedContactDelegationClient } from "./TrustedContactDelegationClient";
import { PatientNotifications } from "./PatientNotifications";
import { PatientAccessSummarySettings } from "./PatientAccessSummarySettings";
import { PushNotificationToggle } from "./PushNotificationToggle";
import { OfflineDataToggle } from "./OfflineDataToggle";
import { primeCsrf, readCsrfToken } from "../infrastructure/api/client";
import { cleanUpBeforeLogout } from "../lib/logout";
import { accountLabel, profileInitials, profileName, type PatientProfileEntry } from "../lib/patient-profiles";
import { LogoutAllSetting } from "./LogoutAllSetting";

const API = "";
type Account = { first_name: string; last_name: string; email: string; avatar_url: string; is_privileged: boolean };
const sections: SettingsNavItem[] = [
  { id: "personnel", title: "Mes informations personnelles", description: "Modifier mon nom et ma photo de profil.", icon: "idcard" },
  { id: "sante", title: "Informations de santé déclaratives", description: "Téléphone, adresse et couverture santé.", icon: "heart" },
  { id: "etablissements-partenaires", title: "Établissements proches de moi", description: "Carte et recherche des hôpitaux, cliniques et centres de santé partenaires.", icon: "pin" },
  { id: "notifications", title: "Notifications", description: "Consulter les notifications de votre carnet et les marquer comme lues.", icon: "bell" },
  { id: "recapitulatif-acces", title: "Récapitulatif des accès", description: "Recevoir un résumé périodique des lectures de votre carnet.", icon: "eye" },
  { id: "hors-connexion", title: "Hors connexion", description: "Naviguer sans réseau avec une copie chiffrée de vos données, en lecture seule.", icon: "download" },
  { id: "proches", title: "Profils", description: "Gérer les profils des enfants que vous représentez.", icon: "users" },
  { id: "proches-de-confiance", title: "Proches de confiance", description: "Inviter ou retirer un accès limité à la fiche d’urgence.", icon: "users" },
  { id: "compte", title: "Personnalisation de mon compte", description: "Personnaliser l’apparence de l’application.", icon: "sparkle" },
  { id: "securite", title: "Sécurité et connexion", description: "Fournisseurs de connexion et appareils connectés.", icon: "lock" },
  { id: "en-savoir-plus", title: "En savoir plus", description: "Aide, informations et documents Mon E‑Carnet.", icon: "help" },
  { id: "avis", title: "Noter l’application", description: "Partager une suggestion ou signaler un problème.", icon: "pencil" },
];
/* Rubriques qui concernent le titulaire lui-même (son identité, ses profils d'enfants, ses proches de confiance) : elles ne s'affichent pas
   tant qu'un profil d'enfant est ouvert. Pour y revenir, on repasse sur « Compte patient » avec la flèche de la carte du haut. */
const HOLDER_ONLY_SECTIONS = new Set(["personnel", "proches", "proches-de-confiance"]);
function titleFor(id: string) { return sections.find((section) => section.id === id)?.title ?? "Paramètres"; }
function initials(account: Account) { return `${account.first_name?.[0] ?? ""}${account.last_name?.[0] ?? ""}`.toUpperCase() || "EC"; }

function PatientSummary({ account, message, profiles, active, onError }: { account: Account; message: string; profiles: PatientProfileEntry[]; active: PatientProfileEntry | null; onError: (message: string) => void }) {
  const stats = usePatientStats(active?.patient_id ?? "holder");
  const holderName = [account.first_name, account.last_name].filter(Boolean).join(" ") || "Mon compte";
  return (
    <ProfileSummary
      avatar={<div className="avatar avatar--large" aria-hidden="true">{active ? profileInitials(active) : account.avatar_url ? <img src={account.avatar_url} alt="" /> : initials(account)}</div>}
      eyebrow={accountLabel(active)}
      eyebrowAction={profiles.length > 0 ? <PatientProfileSwitcher holderName={holderName} holderInitials={initials(account)} profiles={profiles} active={active} onError={onError} /> : undefined}
      name={active ? profileName(active) : holderName} stats={stats}
    >
      <p className="notice" role="status" aria-live="polite">{active ? `Vous consultez le profil de ${active.first_name}. Chacun de vos accès à ce dossier est journalisé.` : message}</p>
    </ProfileSummary>
  );
}

export function AccountSettingsClient() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [avatarValue, setAvatarValue] = useState("");
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [message, setMessage] = useState("Chargement de votre profil…");
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [requestedSection, setActiveSection] = useState<string | null>(null);
  const { usable: childProfiles, active: activeChild } = usePatientProfiles();
  const visibleSections = activeChild ? sections.filter((section) => !HOLDER_ONLY_SECTIONS.has(section.id)) : sections;
  // Rubrique réellement ouverte : celle demandée, si elle existe pour le profil affiché (voir HOLDER_ONLY_SECTIONS).
  const activeSection = visibleSections.some((section) => section.id === requestedSection) ? requestedSection : null;

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("section");
    // Le lien d’accueil ouvre directement la rubrique demandée dans les paramètres.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronise la navigation initiale avec le paramètre URL.
    if (sections.some((section) => section.id === requested)) setActiveSection(requested);
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`${API}/api/v1/identity/me/`, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message ?? "Session requise.");
        if (active) {
          setAccount(payload.data as Account);
          setAvatarValue(payload.data.avatar_url ?? "");
          setMessage("Profil chargé depuis votre compte.");
        }
      })
      .catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : "Profil indisponible."); });
    return () => { active = false; };
  }, []);


  async function saveIdentity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setMessage("Enregistrement…");
    try {
      const csrfResponse = await primeCsrf();
      if (!csrfResponse.ok) throw new Error("Impossible d’établir une session sécurisée.");
      const image = !avatarChanged ? {} : avatarValue.startsWith("data:image/webp;base64,")
        ? { avatar_data: avatarValue, avatar_url: "" }
        : { avatar_data: "", avatar_url: avatarValue };
      const response = await fetch(`${API}/api/v1/identity/me/profile/`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": readCsrfToken() },
        body: JSON.stringify({ ...fields, ...image }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Enregistrement impossible.");
      setAccount(payload.data as Account);
      setAvatarValue(payload.data.avatar_url ?? "");
      setAvatarChanged(false);
      setMessage("Informations personnelles enregistrées.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally { setBusy(false); }
  }


  async function logout() {
    setSigningOut(true);
    try {
      await cleanUpBeforeLogout(); // push + copie locale des déclarations, tant que la session existe
      const csrf = await primeCsrf();
      if (!csrf.ok) throw new Error("Impossible d’établir une session sécurisée.");
      const response = await fetch(`${API}/api/v1/identity/logout/`, { method: "POST", credentials: "include", headers: { "X-CSRFToken": readCsrfToken() } });
      if (!response.ok) throw new Error("La déconnexion n’a pas abouti.");
      router.push("/connexion");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "La déconnexion n’a pas abouti.");
      setSigningOut(false);
    }
  }

  if (!account) return <section className="card"><p className="notice" role="status">{message}</p></section>;
  return (
    <div className="settings-page">
      <PatientSummary account={account} message={message} profiles={childProfiles} active={activeChild} onError={setMessage} />

      <PatientEmergencyCardSettingsClient key={activeChild?.patient_id ?? "holder"} profile={activeChild} />

      <SettingsDirectory items={visibleSections} activeId={activeSection} onSelect={setActiveSection} onLogout={() => void logout()} logoutDisabled={signingOut} />

      {activeSection === "personnel" && <SettingsModal title={titleFor(activeSection)} onClose={() => setActiveSection(null)}><div className="settings-modal-section">
        <span className="eyebrow">Mon identité</span><p className="muted">Votre nom et votre photo sont rattachés à votre compte Mon E‑Carnet.</p>
        <form className="settings-form" onSubmit={saveIdentity}>
          <div className="auth-name-grid"><label className="field"><span>Prénom</span><input name="first_name" required autoComplete="given-name" defaultValue={account.first_name} disabled={busy} /></label><label className="field"><span>Nom</span><input name="last_name" required autoComplete="family-name" defaultValue={account.last_name} disabled={busy} /></label></div>
          <label className="field"><span>Photo de profil</span><AvatarPicker value={avatarValue} onChange={(value) => { setAvatarValue(value); setAvatarChanged(true); }} fallback={initials(account)} disabled={busy} /><small className="muted">Touchez la photo pour en choisir une nouvelle.</small></label>
          <div className="actions"><button className="button primary" disabled={busy} type="submit">{busy ? "Enregistrement…" : "Enregistrer mes informations"}</button></div>
          <p className="status" role="status" aria-live="polite">{message}</p>
        </form>
      </div></SettingsModal>}

      {activeSection === "sante" && <SettingsModal title={titleFor(activeSection)} onClose={() => setActiveSection(null)}><div className="settings-modal-section">
        <span className="eyebrow">Déclaratif</span><p className="muted">Les allergies, antécédents et traitements que vous déclarez sont conservés dans votre carnet.</p>
        <div className="actions"><Link className="button" href="/patient/carnet">Gérer mes déclarations du carnet</Link></div>
        <PatientHealthSettingsClient />
      </div></SettingsModal>}

      {activeSection === "etablissements-partenaires" && <SettingsModal title={titleFor(activeSection)} onClose={() => setActiveSection(null)}><div className="settings-modal-section"><span className="eyebrow">Partenaires Mon E‑Carnet</span><NearbyEstablishments /></div></SettingsModal>}

      {activeSection === "notifications" && <SettingsModal title={titleFor(activeSection)} onClose={() => setActiveSection(null)}><PushNotificationToggle /><div className="settings-modal-section"><PatientNotifications /></div></SettingsModal>}

      {activeSection === "recapitulatif-acces" && <SettingsModal title={titleFor(activeSection)} onClose={() => setActiveSection(null)}><PatientAccessSummarySettings /></SettingsModal>}


      {activeSection === "hors-connexion" && <SettingsModal title={titleFor(activeSection)} onClose={() => setActiveSection(null)}><OfflineDataToggle /></SettingsModal>}
      {activeSection === "proches" && <SettingsModal title={titleFor(activeSection)} onClose={() => setActiveSection(null)}><div className="settings-modal-section">
        <span className="eyebrow">Représentation explicite</span>
        <PatientRepresentationsSettingsClient />
      </div></SettingsModal>}

      {activeSection === "proches-de-confiance" && <SettingsModal title={titleFor(activeSection)} onClose={() => setActiveSection(null)}><div className="settings-modal-section">
        <span className="eyebrow">Délégation limitée et révocable</span>
        <TrustedContactDelegationClient />
      </div></SettingsModal>}

      {activeSection === "compte" && <SettingsModal title={titleFor(activeSection)} onClose={() => setActiveSection(null)}><div className="settings-modal-section">
        <span className="eyebrow">Préférences personnelles</span><p className="muted">Vos choix d’apparence sont enregistrés sur votre compte et vous suivent sur vos autres appareils.</p>
        <ThemeSettingsClient compact space="patient" />
      </div></SettingsModal>}

      {activeSection === "securite" && <SettingsModal title={titleFor(activeSection)} onClose={() => setActiveSection(null)}><div className="settings-modal-section">
        <span className="eyebrow">Accès au compte</span><LinkedProvidersSettingsClient nextPath="/patient/parametres" />
        <LogoutAllSetting disabled={signingOut} />
        <AccountActionRequestsSettingsClient isPrivileged={account.is_privileged} />
      </div></SettingsModal>}

      {activeSection === "en-savoir-plus" && <SettingsModal title={titleFor(activeSection)} onClose={() => setActiveSection(null)}><SettingsMoreSection /></SettingsModal>}
      {activeSection === "avis" && <SettingsModal title={titleFor(activeSection)} onClose={() => setActiveSection(null)}><div className="settings-modal-section"><span className="eyebrow">Amélioration continue</span><p className="muted">Votre retour aide l’équipe Mon E‑Carnet à améliorer l’application. N’indiquez aucune information personnelle ou médicale.</p><LandingFeedbackWidget inline /></div></SettingsModal>}
    </div>
  );
}
