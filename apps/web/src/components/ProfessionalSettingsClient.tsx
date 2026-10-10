"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeSettingsClient } from "./ThemeSettingsClient";
import { primeCsrf, readCsrfToken } from "../infrastructure/api/client";

type Profile = { professional_title: string; specialty: string; active_establishment: string | null };
type Establishment = { id: string; name: string; status: string };
type Account = { email: string; first_name: string; last_name: string; contexts: { role: string; is_active: boolean }[] };
type Envelope<T> = { data?: T; message?: string; detail?: string };
const API = "";

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, { credentials: "include", cache: "no-store" });
  const payload = await response.json() as Envelope<T>;
  if (response.status === 401 || response.status === 403) throw new Error("SESSION_REQUIRED");
  if (!response.ok) throw new Error(payload.message ?? payload.detail ?? "Service indisponible.");
  return payload.data as T;
}

function csrfToken(): string {
  return readCsrfToken();
}

export function ProfessionalSettingsClient() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionRequired, setSessionRequired] = useState(false);
  const [message, setMessage] = useState("Chargement du profil professionnel…");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      get<Account>("/api/v1/identity/me/"),
      get<Profile>("/api/v1/professionals/me/"),
      get<Establishment[]>("/api/v1/establishments/"),
    ]).then(([accountData, profileData, establishmentData]) => {
      if (!active) return;
      setAccount(accountData);
      setProfile(profileData);
      setEstablishments(establishmentData);
      setMessage("Profil professionnel chargé depuis votre compte.");
    }).catch((error: unknown) => {
      if (!active) return;
      if (error instanceof Error && error.message === "SESSION_REQUIRED") {
        setSessionRequired(true);
        setMessage("Connectez-vous pour consulter vos informations professionnelles.");
      } else setMessage(error instanceof Error ? error.message : "Impossible de charger le profil.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function logout() {
    setSigningOut(true);
    try {
      const csrf = await primeCsrf();
      const response = await fetch(`${API}/api/v1/identity/logout/`, { method: "POST", credentials: "include", headers: { "X-CSRFToken": csrfToken() } });
      if (!csrf.ok || !response.ok) throw new Error("La déconnexion n’a pas abouti.");
      router.push("/connexion");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "La déconnexion n’a pas abouti.");
      setSigningOut(false);
    }
  }

  if (sessionRequired) return <section className="card settings-auth-gate"><span className="eyebrow">Espace professionnel sécurisé</span><h2>Connexion requise</h2><p className="muted">Votre profil professionnel et vos rattachements sont visibles après connexion.</p><div className="actions"><Link className="button primary" href="/connexion?next=%2Fprofessionnel%2Fparametres">Se connecter</Link><Link className="button" href="/">Accueil</Link></div></section>;

  const activeEstablishment = establishments.find((item) => item.id === profile?.active_establishment);
  const fullName = `${account?.first_name ?? ""} ${account?.last_name ?? ""}`.trim() || account?.email || "Profil professionnel";

  return <div className="settings-page professional-settings">
    <section className="card account-summary">
      <div className="profile-summary"><div className="avatar avatar--large" aria-hidden="true">{fullName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div><div><span className="eyebrow">Mon profil professionnel</span><h2>{fullName}</h2><p className="muted">{profile?.professional_title || "Profession à renseigner"} · {profile?.specialty || "Spécialité à renseigner"}</p></div></div>
      <nav className="setting-list" aria-label="Sections de mon profil"><a className="setting-item" href="#professionnel"><span className="setting-item__meta"><span className="setting-item__icon">ID</span>Informations professionnelles</span><span>›</span></a><a className="setting-item" href="#etablissement"><span className="setting-item__meta"><span className="setting-item__icon">▣</span>Mon établissement actif</span><span>›</span></a><a className="setting-item" href="#compte"><span className="setting-item__meta"><span className="setting-item__icon">◉</span>Compte et apparence</span><span>›</span></a><a className="setting-item" href="#securite"><span className="setting-item__meta"><span className="setting-item__icon">▣</span>Sécurité et connexion</span><span>›</span></a><button type="button" className="setting-item setting-item--danger" disabled={loading || signingOut} onClick={logout}><span className="setting-item__meta"><span className="setting-item__icon">↩</span>Se déconnecter</span></button></nav>
      <p className="notice" role="status" aria-live="polite">{loading ? "Chargement…" : message}</p>
    </section>
    <div className="settings-stack">
      <section className="card" id="professionnel"><span className="eyebrow">Profil professionnel</span><h2>Informations professionnelles</h2><dl className="settings-details"><div><dt>Profession</dt><dd>{profile?.professional_title || "À renseigner"}</dd></div><div><dt>Spécialité</dt><dd>{profile?.specialty || "À renseigner"}</dd></div></dl><p className="settings-note muted">La spécialité est déclarée par vous. Les justificatifs médicaux ne sont pas collectés par E‑Carnet : leur vérification relève de l’établissement.</p></section>
      <section className="card" id="etablissement"><span className="eyebrow">Rattachement</span><h2>Mon établissement</h2><dl className="settings-details"><div><dt>Établissement actif</dt><dd>{activeEstablishment?.name ?? (profile?.active_establishment ? "Établissement actif" : "Aucun établissement actif")}</dd></div><div><dt>Email de connexion</dt><dd>{account?.email ?? (loading ? "Chargement…" : "Non disponible")}</dd></div></dl><div className="actions"><Link className="button" href="/professionnel/etablissements">Gérer les rattachements</Link>{profile?.active_establishment && <Link className="button" href="/etablissement/parametres">Paramètres établissement</Link>}</div></section>
      <section className="card" id="compte"><span className="eyebrow">Préférences</span><h2>Compte et apparence</h2><ThemeSettingsClient /></section>
      <section className="card" id="securite"><span className="eyebrow">Sécurité</span><h2>Sécurité et connexion</h2><ul className="info-list"><li>Le compte est lié à cette session sécurisée.</li><li>L’établissement effectue sa vérification professionnelle en interne ; l’API contrôle le rattachement actif.</li><li>La gestion des appareils et le MFA renforcé ne sont pas disponibles dans la V1.</li></ul><button type="button" className="button setting-logout" disabled={loading || signingOut} onClick={logout}>Se déconnecter</button></section>
    </div>
  </div>;
}
