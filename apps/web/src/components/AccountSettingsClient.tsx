"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AvatarPicker } from "./AvatarPicker";
import { LinkedProvidersSettingsClient } from "./LinkedProvidersSettingsClient";
import { PatientHealthSettingsClient } from "./PatientHealthSettingsClient";
import { SettingsDirectory, type SettingsNavItem } from "./SettingsDirectory";
import { SettingsMoreSection } from "./SettingsMoreSection";
import { ThemeSettingsClient } from "./ThemeSettingsClient";
import { primeCsrf, readCsrfToken } from "../infrastructure/api/client";

const API = "";
type Account = { first_name: string; last_name: string; email: string; avatar_url: string };
const sections: SettingsNavItem[] = [
  { id: "personnel", title: "Mes informations personnelles", description: "Modifier mon nom et ma photo de profil.", icon: "ID" },
  { id: "sante", title: "Informations de santé déclaratives", description: "Téléphone, adresse et couverture santé.", icon: "♡" },
  { id: "compte", title: "Paramètres du compte", description: "Personnaliser l’apparence de l’application.", icon: "◉" },
  { id: "securite", title: "Sécurité et connexion", description: "Gérer les fournisseurs liés au compte.", icon: "▣" },
  { id: "en-savoir-plus", title: "En savoir plus", description: "Aide, informations et documents E‑Carnet.", icon: "i" },
];

function initials(account: Account) {
  return `${account.first_name?.[0] ?? ""}${account.last_name?.[0] ?? ""}`.toUpperCase() || "EC";
}

export function AccountSettingsClient() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [avatarValue, setAvatarValue] = useState("");
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [message, setMessage] = useState("Chargement de votre profil…");
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

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
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setSigningOut(true);
    try {
      const csrf = await primeCsrf();
      if (!csrf.ok) throw new Error("Impossible d’établir une session sécurisée.");
      const response = await fetch(`${API}/api/v1/identity/logout/`, {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRFToken": readCsrfToken() },
      });
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
      <section className="card account-summary settings-account-summary">
        <div className="profile-summary">
          <div className="avatar avatar--large" aria-hidden="true">{account.avatar_url ? <img src={account.avatar_url} alt="" /> : initials(account)}</div>
          <div className="settings-account-summary__copy">
            <span className="eyebrow">Compte patient</span>
            <h2>{[account.first_name, account.last_name].filter(Boolean).join(" ") || "Mon compte"}</h2>
            <p className="muted">{account.email}</p>
          </div>
        </div>
        <p className="notice" role="status" aria-live="polite">{message}</p>
      </section>

      <SettingsDirectory items={sections} onLogout={() => void logout()} logoutDisabled={signingOut} />

      <section className="card settings-anchor" id="personnel" aria-labelledby="personal-settings-title">
        <span className="eyebrow">Mon identité</span>
        <h2 id="personal-settings-title">Mes informations personnelles</h2>
        <p className="muted">Votre nom et votre photo sont rattachés à votre compte E‑Carnet.</p>
        <form className="settings-form" onSubmit={saveIdentity}>
          <div className="auth-name-grid">
            <label className="field"><span>Prénom</span><input name="first_name" required autoComplete="given-name" defaultValue={account.first_name} disabled={busy} /></label>
            <label className="field"><span>Nom</span><input name="last_name" required autoComplete="family-name" defaultValue={account.last_name} disabled={busy} /></label>
          </div>
          <label className="field"><span>Photo de profil</span><AvatarPicker value={avatarValue} onChange={(value) => { setAvatarValue(value); setAvatarChanged(true); }} fallback={initials(account)} disabled={busy} /><small className="muted">Touchez la photo pour en choisir une nouvelle.</small></label>
          <div className="actions"><button className="button primary" disabled={busy} type="submit">{busy ? "Enregistrement…" : "Enregistrer mes informations"}</button></div>
          <p className="status" role="status" aria-live="polite">{message}</p>
        </form>
      </section>

      <section className="card settings-anchor" id="sante" aria-labelledby="health-settings-title">
        <span className="eyebrow">Déclaratif</span>
        <h2 id="health-settings-title">Informations de santé déclaratives</h2>
        <p className="muted">Les allergies, antécédents et traitements que vous déclarez sont conservés dans votre carnet.</p>
        <div className="actions"><Link className="button" href="/patient/carnet">Gérer mes déclarations du carnet</Link></div>
        <PatientHealthSettingsClient />
      </section>

      <section className="card settings-anchor" id="compte" aria-labelledby="account-preferences-title">
        <span className="eyebrow">Préférences personnelles</span>
        <h2 id="account-preferences-title">Paramètres du compte</h2>
        <p className="muted">Vos choix d’apparence sont enregistrés sur votre compte et vous suivent sur vos autres appareils.</p>
        <ThemeSettingsClient compact />
      </section>

      <section className="card settings-anchor" id="securite" aria-labelledby="security-settings-title">
        <span className="eyebrow">Accès au compte</span>
        <h2 id="security-settings-title">Sécurité et connexion</h2>
        <LinkedProvidersSettingsClient nextPath="/patient/parametres" />
      </section>

      <SettingsMoreSection />
    </div>
  );
}
