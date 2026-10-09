"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { primeCsrf, readCsrfToken } from "../infrastructure/api/client";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
type Account = { first_name: string; last_name: string; avatar_url: string };
export function IdentityOnboarding() {
  const router = useRouter();
  const [form, setForm] = useState<Account>({ first_name: "", last_name: "", avatar_url: "" });
  const [message, setMessage] = useState("Votre nom et votre avatar restent modifiables depuis les paramètres du compte.");
  useEffect(() => { fetch(`${API}/api/v1/identity/me/`, { credentials: "include" }).then(r => r.json()).then(p => { if (p.data) setForm({ first_name: p.data.first_name ?? "", last_name: p.data.last_name ?? "", avatar_url: p.data.avatar_url ?? "" }); }).catch(() => undefined); }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setMessage("Enregistrement…");
    await primeCsrf();
    const csrf = readCsrfToken();
    const response = await fetch(`${API}/api/v1/identity/me/profile/`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRFToken": csrf }, body: JSON.stringify(form) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(payload.message ?? "Impossible d’enregistrer votre identité."); return; }
    router.push("/onboarding");
  }
  const initials = `${form.first_name[0] ?? ""}${form.last_name[0] ?? ""}`.toUpperCase() || "EC";
  return <form className="card auth-form" onSubmit={submit}>
    <span className="eyebrow">Étape 1 · votre identité</span><h1>Présentez-vous comme vous le souhaitez.</h1>
    <p className="muted">Votre identité sert à vous reconnaître dans votre espace. Elle n’ouvre aucun accès clinique.</p>
    <div className="profile-summary"><div className="avatar avatar--large" aria-label="Aperçu de l’avatar">{form.avatar_url ? <img src={form.avatar_url} alt="" /> : initials}</div><div><strong>{[form.first_name, form.last_name].filter(Boolean).join(" ") || "Votre nom"}</strong><p className="muted">Aperçu de votre profil</p></div></div>
    <div className="auth-name-grid"><label className="field"><span>Prénom</span><input required autoComplete="given-name" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} /></label><label className="field"><span>Nom</span><input required autoComplete="family-name" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} /></label></div>
    <label className="field"><span>Avatar (URL d’image, facultatif)</span><input type="url" inputMode="url" placeholder="https://…" value={form.avatar_url} onChange={e => setForm({ ...form, avatar_url: e.target.value })} /><small className="muted">Vous pouvez le remplacer ou le supprimer plus tard.</small></label>
    <button className="button primary" type="submit">Continuer</button><p className="status" role="status">{message}</p>
  </form>;
}
