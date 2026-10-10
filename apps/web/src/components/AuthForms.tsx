"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { primeCsrf, readCsrfToken } from "../infrastructure/api/client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function ProviderIcon({ provider }: { provider: string }) {
  if (provider === "google") return <svg aria-hidden="true" viewBox="0 0 24 24" className="provider-icon"><path fill="#4285F4" d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.2c1.9-1.8 3.1-4.4 3.1-7.5Z"/><path fill="#34A853" d="M12 22c2.8 0 5.2-.9 6.9-2.4l-3.2-2.6c-.9.6-2.1 1-3.7 1-2.8 0-5.2-1.9-6-4.5H2.7v2.7A10.4 10.4 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6 13.5a6.2 6.2 0 0 1 0-3.9V6.9H2.7a10.1 10.1 0 0 0 0 9.2L6 13.5Z"/><path fill="#EA4335" d="M12 5.1c1.5 0 2.8.5 3.8 1.5l2.8-2.8C17.2 2.1 14.8 1 12 1a10.4 10.4 0 0 0-9.3 5.9L6 9.5c.8-2.6 3.2-4.4 6-4.4Z"/></svg>;
  if (provider === "facebook") return <svg aria-hidden="true" viewBox="0 0 24 24" className="provider-icon"><path fill="currentColor" d="M13.5 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.6-1.5h1.7V3.9c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1V10H7.7v3H10v8h3.5Z"/></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="provider-icon"><path fill="currentColor" d="M16.7 12.7c0-2.1 1.7-3.1 1.8-3.2-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.4.8-.7 0-1.7-.8-2.8-.8-1.5 0-2.9.9-3.7 2.2-1.6 2.7-.4 6.7 1.1 8.9.8 1.1 1.6 2.3 2.8 2.2 1.1 0 1.6-.7 2.9-.7s1.7.7 2.9.7c1.2 0 2-.1 2.8-1.3.9-1.3 1.3-2.5 1.3-2.6-.1 0-2.5-1-2.5-2.5Z"/><path fill="currentColor" d="M15.1 6.7c.6-.8 1-1.9.9-3-.9 0-2 .6-2.6 1.3-.6.7-1 1.8-.9 2.9 1 0 2-.5 2.6-1.2Z"/></svg>;
}

export function AuthForms({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", first_name: "", last_name: "" });
  const [message, setMessage] = useState("");
  useEffect(() => {
    setMessage(new URLSearchParams(window.location.search).get("message") ?? "");
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMessage("Connexion sécurisée en cours…");
    const tokenResponse = await primeCsrf();
    const token = readCsrfToken();
    const r = await fetch(`${API}/api/v1/identity/${mode}/`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRFToken": token }, body: JSON.stringify(form) });
    const p = await r.json();
    if (!tokenResponse.ok || !r.ok) { setMessage(p.message ?? "Impossible de poursuivre."); return; }
    const nextParam = new URLSearchParams(window.location.search).get("next");
    const next = nextParam?.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null;
    router.push(next ?? (mode === "register" ? "/onboarding/identite" : "/patient"));
  }
  return <div className="auth-card">
    <div className="auth-card__header"><p className="brand brand--compact"><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="6" y="3" width="12" height="18" rx="2"/><path d="M10 3v18M13 9h2"/></svg></span> E-carnet</p></div>
    <span className="eyebrow">{mode === "login" ? "Retrouver mon carnet" : "Créer mon carnet"}</span>
    <h1>{mode === "login" ? "Bon retour parmi nous" : "Votre carnet, sous votre contrôle"}</h1>
    <p className="auth-subtitle">Une identité unique. Des accès temporaires, visibles et révocables.</p>
    <div className="social-grid" aria-label="Méthodes de connexion">
      {(["google", "facebook", "apple"] as const).map(provider => <a className={`social-button social-button--${provider}`} key={provider} href={`${API}/api/v1/identity/oauth/${provider}/start/`}><ProviderIcon provider={provider} /><span>{provider === "google" ? "Continuer avec Google" : provider === "facebook" ? "Continuer avec Facebook" : "Continuer avec Apple"}</span></a>)}
    </div>
    <div className="auth-divider"><span>ou avec mon e-mail</span></div>
    <form className="auth-form-body" onSubmit={submit}>
      {mode === "register" && <div className="auth-name-grid"><label className="field"><span>Prénom</span><input required value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} /></label><label className="field"><span>Nom</span><input required value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} /></label></div>}
      <label className="field"><span>Adresse e-mail</span><input type="email" required autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
      <label className="field"><span>Mot de passe</span><input type="password" required minLength={12} autoComplete={mode === "login" ? "current-password" : "new-password"} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label>
      <button className="button primary auth-submit" type="submit">{mode === "login" ? "Se connecter" : "Créer mon compte"}</button>
    </form>
    {message && <p className="auth-message" role="status">{message}</p>}
  </div>;
}
