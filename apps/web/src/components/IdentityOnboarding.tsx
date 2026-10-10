"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { primeCsrf, readCsrfToken } from "../infrastructure/api/client";
import { AvatarPicker } from "./AvatarPicker";
const API = "";
type Account = { email: string; first_name: string; last_name: string; avatar_url: string };
export function IdentityOnboarding() {
  const router = useRouter();
  const [form, setForm] = useState<Account>({ email: "", first_name: "", last_name: "", avatar_url: "" });
  const [message, setMessage] = useState("Récupération de votre profil…");
  useEffect(() => {
    let active = true;
    fetch(`${API}/api/v1/identity/me/`, { credentials: "include", cache: "no-store" })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message ?? "Votre session n’est pas accessible. Reconnectez-vous puis réessayez.");
        if (active && payload.data) {
          setForm({ email: payload.data.email ?? "", first_name: payload.data.first_name ?? "", last_name: payload.data.last_name ?? "", avatar_url: payload.data.avatar_url ?? "" });
          setMessage("Profil récupéré. Vous pouvez modifier votre prénom, votre nom ou votre avatar avant de continuer.");
        }
      })
      .catch(error => { if (active) setMessage(error instanceof Error ? error.message : "Impossible de récupérer votre profil."); });
    return () => { active = false; };
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setMessage("Enregistrement…");
    const csrfResponse = await primeCsrf();
    if (!csrfResponse.ok) { setMessage("Impossible d’établir une session sécurisée. Réessayez."); return; }
    const response = await fetch(`${API}/api/v1/identity/me/profile/`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRFToken": readCsrfToken() }, body: JSON.stringify(form.avatar_url.startsWith("data:image/webp;base64,") ? { first_name: form.first_name, last_name: form.last_name, avatar_data: form.avatar_url, avatar_url: "" } : { first_name: form.first_name, last_name: form.last_name, avatar_data: "", avatar_url: form.avatar_url }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(payload.message ?? "Impossible d’enregistrer votre identité."); return; }
    router.push("/onboarding");
  }
  const initials = `${form.first_name[0] ?? ""}${form.last_name[0] ?? ""}`.toUpperCase() || "EC";
  return <form className="card auth-form" onSubmit={submit}>
    <span className="eyebrow">Étape 1 · votre identité</span><h1>Présentez-vous comme vous le souhaitez.</h1>
    <p className="muted">Votre profil Google a prérempli les informations disponibles. Vérifiez-les ou modifiez-les avant de continuer.</p>
    <div className="profile-summary"><AvatarPicker value={form.avatar_url} onChange={avatar_url => setForm({ ...form, avatar_url })} fallback={initials} /><div><strong>{[form.first_name, form.last_name].filter(Boolean).join(" ") || "Votre nom"}</strong><p className="muted">Cliquez sur la photo pour la modifier</p></div></div>
    <label className="field"><span>E-mail du compte</span><input type="email" autoComplete="email" value={form.email} readOnly /><small className="muted">Adresse vérifiée par votre fournisseur de connexion.</small></label>
    <div className="auth-name-grid"><label className="field"><span>Prénom</span><input required autoComplete="given-name" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} /></label><label className="field"><span>Nom</span><input required autoComplete="family-name" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} /></label></div>
    <button className="button primary" type="submit">Continuer</button><p className="status" role="status">{message}</p>
  </form>;
}
