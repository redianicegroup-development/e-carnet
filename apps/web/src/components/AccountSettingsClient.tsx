"use client";
import { useEffect, useState } from "react";
import { primeCsrf, readCsrfToken } from "../infrastructure/api/client";
import { AvatarPicker } from "./AvatarPicker";
const API = "";
type Account = { first_name: string; last_name: string; email: string; avatar_url: string; auth_identities: { provider: string; display_name: string; avatar_url: string }[] };
const labels: Record<string, string> = { google: "Google", facebook: "Facebook", apple: "Apple" };
function csrf() { return readCsrfToken(); }
export function AccountSettingsClient() {
  const [account, setAccount] = useState<Account | null>(null); const [avatarValue, setAvatarValue] = useState(""); const [avatarChanged, setAvatarChanged] = useState(false); const [message, setMessage] = useState("Chargement de votre profil…"); const [busy, setBusy] = useState(false);
  async function load() { const r = await fetch(`${API}/api/v1/identity/me/`, { credentials: "include", cache: "no-store" }); const p = await r.json(); if (!r.ok) throw new Error(p.message ?? "Session requise."); setAccount(p.data); setAvatarValue(p.data.avatar_url ?? ""); setAvatarChanged(false); }
  useEffect(() => {
    let active = true;
    fetch(`${API}/api/v1/identity/me/`, { credentials: "include", cache: "no-store" }).then(async r => {
      const p = await r.json();
      if (!r.ok) throw new Error(p.message ?? "Session requise.");
      if (active) { setAccount(p.data); setAvatarValue(p.data.avatar_url ?? ""); setAvatarChanged(false); setMessage("Profil chargé depuis votre compte."); }
    }).catch(e => { if (active) setMessage(e instanceof Error ? e.message : "Profil indisponible."); });
    return () => { active = false; };
  }, []);
  async function saveIdentity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try {
      const csrfResponse = await primeCsrf();
      if (!csrfResponse.ok) throw new Error("Impossible d’établir une session sécurisée.");
      const fields = Object.fromEntries(new FormData(event.currentTarget));
      const image = !avatarChanged ? {} : avatarValue.startsWith("data:image/webp;base64,") ? { avatar_data: avatarValue, avatar_url: "" } : { avatar_data: "", avatar_url: avatarValue };
      const r = await fetch(`${API}/api/v1/identity/me/profile/`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRFToken": csrf() }, body: JSON.stringify({ ...fields, ...image }) });
      const p = await r.json();
      if (!r.ok) throw new Error(p.message ?? "Enregistrement impossible.");
      setAccount(p.data); setAvatarValue(p.data.avatar_url ?? ""); setAvatarChanged(false); setMessage("Identité mise à jour.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Enregistrement impossible."); }
    finally { setBusy(false); }
  }
  async function unlink(provider: string) { setBusy(true); try { await primeCsrf(); const r = await fetch(`${API}/api/v1/identity/oauth/identities/${provider}/`, { method: "DELETE", credentials: "include", headers: { "X-CSRFToken": csrf() } }); const p = await r.json(); if (!r.ok) throw new Error(p.message ?? "Déliaison impossible."); await load(); setMessage(`${labels[provider] ?? provider} a été délié.`); } catch (e) { setMessage(e instanceof Error ? e.message : "Déliaison impossible."); } finally { setBusy(false); } }
  const initials = `${account?.first_name?.[0] ?? ""}${account?.last_name?.[0] ?? ""}`.toUpperCase() || "EC";
  if (!account) return <section className="card"><p className="notice" role="status">{message}</p></section>;
  const linked = new Set(account.auth_identities.map(identity => identity.provider));
  return <div className="settings-stack">
    <section className="card account-summary"><div className="profile-summary"><div className="avatar avatar--large">{account.avatar_url ? <img src={account.avatar_url} alt="" /> : initials}</div><div><span className="eyebrow">Mon identité</span><h1>{[account.first_name, account.last_name].filter(Boolean).join(" ")}</h1><p className="muted">{account.email}</p></div></div><p className="notice" role="status">{message}</p></section>
    <form className="card" onSubmit={saveIdentity}><span className="eyebrow">Identité éditable</span><h2>Nom et avatar</h2><div className="auth-name-grid"><label className="field"><span>Prénom</span><input name="first_name" required defaultValue={account.first_name} /></label><label className="field"><span>Nom</span><input name="last_name" required defaultValue={account.last_name} /></label></div><div className="field"><span>Photo de profil</span><AvatarPicker value={avatarValue} onChange={value => { setAvatarValue(value); setAvatarChanged(true); }} fallback={initials} disabled={busy} /><small className="muted">Cliquez sur la photo pour en choisir une nouvelle.</small></div><button className="button primary" disabled={busy} type="submit">Enregistrer l’identité</button></form>
    <section className="card"><span className="eyebrow">Connexion</span><h2>Fournisseurs liés</h2><p className="muted">La liaison se fait depuis une session authentifiée. Aucun compte n’est fusionné automatiquement par adresse email.</p><div className="stack">{(["google", "facebook", "apple"] as const).map(provider => <div className="record" key={provider}><div><strong>{labels[provider]}</strong><p className="muted">{linked.has(provider) ? "Lié à ce compte" : "Non lié"}</p></div>{linked.has(provider) ? <button type="button" className="button small" disabled={busy} onClick={() => void unlink(provider)}>Délier</button> : <a className="button small" href={`${API}/api/v1/identity/oauth/${provider}/start/?next=%2Fpatient%2Fparametres`}>Lier</a>}</div>)}</div></section>
  </div>;
}
