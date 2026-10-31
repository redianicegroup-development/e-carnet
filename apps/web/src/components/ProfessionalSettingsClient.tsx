"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LinkedProvidersSettingsClient } from "./LinkedProvidersSettingsClient";
import { ProfileSummary, CardBar } from "./ProfileSummary";
import { SettingsDirectory, type SettingsNavItem } from "./SettingsDirectory";
import { SettingsModal } from "./SettingsModal";
import { SettingsMoreSection } from "./SettingsMoreSection";
import { LandingFeedbackWidget } from "./LandingFeedbackWidget";
import { ThemeSettingsClient } from "./ThemeSettingsClient";
import { AccountActionRequestsSettingsClient } from "./AccountActionRequestsSettingsClient";
import { primeCsrf, readCsrfToken } from "../infrastructure/api/client";
import { ProfessionalCredentialsSettings } from "./ProfessionalCredentialsSettings";
import "./establishment-settings.css";

type Profile = { professional_title: string; specialty: string; professional_identifier: string; active_establishment: string | null; stamp_uploaded: boolean; signature_uploaded: boolean };
type Establishment = { id: string; name: string; status: string };
type Account = { email: string; first_name: string; last_name: string; avatar_url?: string; is_privileged: boolean; contexts: { role: string; is_active: boolean }[] };
type Envelope<T> = { data?: T; message?: string; detail?: string };
const API = "";

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, { credentials: "include", cache: "no-store" });
  const payload = await response.json() as Envelope<T>;
  if (response.status === 401 || response.status === 403) throw new Error("SESSION_REQUIRED");
  if (!response.ok) throw new Error(payload.message ?? payload.detail ?? "Service indisponible.");
  return payload.data as T;
}
function initials(name: string) { return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "PR"; }

export function ProfessionalSettingsClient() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionRequired, setSessionRequired] = useState(false);
  const [message, setMessage] = useState("Chargement du profil professionnel…");
  const [signingOut, setSigningOut] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([get<Account>("/api/v1/identity/me/"), get<Profile>("/api/v1/professionals/me/"), get<Establishment[]>("/api/v1/establishments/"), get<Pick<Profile, "professional_identifier" | "stamp_uploaded" | "signature_uploaded">>("/api/v1/professionals/credentials/")])
      .then(([accountData, profileData, establishmentData, credentialsData]) => {
        if (!active) return;
        setAccount(accountData); setProfile({ ...profileData, ...credentialsData }); setEstablishments(establishmentData);
        setMessage("Profil professionnel chargé depuis votre compte.");
      }).catch((error: unknown) => {
        if (!active) return;
        if (error instanceof Error && error.message === "SESSION_REQUIRED") { setSessionRequired(true); setMessage("Connectez-vous pour consulter vos informations professionnelles."); }
        else setMessage(error instanceof Error ? error.message : "Impossible de charger le profil.");
      }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function logout() {
    setSigningOut(true);
    try {
      const csrf = await primeCsrf();
      if (!csrf.ok) throw new Error("Impossible d’établir une session sécurisée.");
      const response = await fetch(`${API}/api/v1/identity/logout/`, { method: "POST", credentials: "include", headers: { "X-CSRFToken": readCsrfToken() } });
      if (!response.ok) throw new Error("La déconnexion n’a pas abouti.");
      router.push("/connexion"); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "La déconnexion n’a pas abouti."); setSigningOut(false); }
  }

  if (sessionRequired) return <section className="card settings-auth-gate"><span className="eyebrow">Espace professionnel sécurisé</span><h2>Connexion requise</h2><p className="muted">Votre profil professionnel et vos rattachements sont visibles après connexion.</p><div className="actions"><Link className="button primary" href="/connexion?next=%2Fprofessionnel%2Fparametres">Se connecter</Link><Link className="button" href="/">Accueil</Link></div></section>;

  const activeEstablishment = establishments.find((item) => item.id === profile?.active_establishment);
  const fullName = `${account?.first_name ?? ""} ${account?.last_name ?? ""}`.trim() || account?.email || "Profil professionnel";
  const navItems: SettingsNavItem[] = [
    { id: "professionnel", title: "Informations professionnelles", description: "Profession et spécialité déclarée.", icon: "stethoscope" },
    { id: "etablissement", title: activeEstablishment ? `Mon établissement — ${activeEstablishment.name}` : "Mon établissement", description: "Établissement actif et rattachements.", icon: "building" },
    { id: "compte", title: "Paramètres du compte", description: "Personnaliser l’apparence de l’application.", icon: "sparkle" },
    { id: "securite", title: "Sécurité et connexion", description: "Gérer les fournisseurs liés au compte.", icon: "lock" },
    { id: "en-savoir-plus", title: "En savoir plus", description: "Aide, informations et documents Mon E‑Carnet.", icon: "help" },
    { id: "avis", title: "Votre avis", description: "Partager une suggestion ou signaler un problème.", icon: "pencil" },
  ];
  const titleFor = (id: string) => navItems.find((item) => item.id === id)?.title ?? "Paramètres";

  return (
    <div className="settings-page professional-settings">
      <ProfileSummary
        avatar={<div className="avatar avatar--large" aria-hidden="true">{account?.avatar_url ? <img src={account.avatar_url} alt="" /> : initials(fullName)}</div>}
        eyebrow="Espace professionnel" name={fullName}
        stats={[{ label: "Profession", value: profile?.professional_title || "À renseigner" }, { label: "Spécialité", value: profile?.specialty || "À renseigner" }]}
        bar={<CardBar href="/professionnel" />}
      >
        <p className="notice" role="status" aria-live="polite">{loading ? "Chargement…" : message}</p>
      </ProfileSummary>
      <SettingsDirectory items={navItems} activeId={activeSection} onSelect={setActiveSection} onLogout={() => void logout()} logoutDisabled={loading || signingOut} />

      {activeSection === "professionnel" && <SettingsModal title={titleFor(activeSection)} onClose={() => setActiveSection(null)}><div className="settings-modal-section"><span className="eyebrow">Profil professionnel</span><dl className="settings-details"><div><dt>Profession</dt><dd>{profile?.professional_title || "À renseigner"}</dd></div><div><dt>Spécialité</dt><dd>{profile?.specialty || "À renseigner"}</dd></div></dl><p className="settings-note muted">La spécialité est déclarée par vous. Les justificatifs médicaux ne sont pas collectés par Mon E‑Carnet : leur vérification relève de l’établissement.</p><div className="actions"><Link className="button" href="/professionnel/onboarding?retour=parametres">Modifier mon profil</Link></div></div>{profile && <ProfessionalCredentialsSettings profile={profile} onSaved={(saved) => setProfile((current) => current ? { ...current, ...saved } : current)} />}</SettingsModal>}

      {activeSection === "etablissement" && <SettingsModal title={titleFor(activeSection)} onClose={() => setActiveSection(null)}><div className="settings-modal-section"><span className="eyebrow">Rattachement</span><dl className="settings-details"><div><dt>Établissement actif</dt><dd>{activeEstablishment?.name ?? (profile?.active_establishment ? "Établissement actif" : "Aucun établissement actif")}</dd></div><div><dt>Email de connexion</dt><dd>{account?.email ?? (loading ? "Chargement…" : "Non disponible")}</dd></div></dl><div className="actions"><Link className="button" href="/professionnel/acces">Gérer les rattachements</Link></div></div></SettingsModal>}

      {activeSection === "compte" && <SettingsModal title={titleFor(activeSection)} onClose={() => setActiveSection(null)}><div className="settings-modal-section"><span className="eyebrow">Préférences personnelles</span><p className="muted">Responsable du compte : {fullName} · {account?.email ?? "Email non disponible"}</p><ThemeSettingsClient compact space="professional" /></div></SettingsModal>}

      {activeSection === "securite" && <SettingsModal title={titleFor(activeSection)} onClose={() => setActiveSection(null)}><div className="settings-modal-section"><span className="eyebrow">Accès au compte</span><p className="muted">Les autorisations professionnelles sont vérifiées côté API. Les fournisseurs ci-dessous servent uniquement à la connexion au compte.</p><LinkedProvidersSettingsClient nextPath="/professionnel/parametres" /><AccountActionRequestsSettingsClient isPrivileged={account?.is_privileged ?? true} /></div></SettingsModal>}

      {activeSection === "en-savoir-plus" && <SettingsModal title={titleFor(activeSection)} onClose={() => setActiveSection(null)}><SettingsMoreSection /></SettingsModal>}
      {activeSection === "avis" && <SettingsModal title={titleFor(activeSection)} onClose={() => setActiveSection(null)}><div className="settings-modal-section"><span className="eyebrow">Amélioration continue</span><p className="muted">Votre retour aide l’équipe Mon E‑Carnet à améliorer l’application. N’indiquez aucune information personnelle ou médicale.</p><LandingFeedbackWidget inline /></div></SettingsModal>}
    </div>
  );
}
