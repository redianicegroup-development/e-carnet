"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { primeCsrf, readCsrfToken } from "../infrastructure/api/client";
import { safeOAuthNext } from "../lib/auth";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
type AuthMode = "login" | "register";
type Account = { contexts?: Array<{ role: string; is_active: boolean; onboarding_completed: boolean }> };
function destinationFor(account: Account, mode: AuthMode, requested: string | null) {
  if (requested?.startsWith("/") && !requested.startsWith("//") && !requested.includes("\\")) return safeOAuthNext(requested);
  if (mode === "register") return "/onboarding/identite";
  const context = account.contexts?.find((item) => item.is_active) ?? account.contexts?.[0];
  if (!context) return "/patient";
  if (context.role === "professional") return context.onboarding_completed ? "/professionnel" : "/professionnel/onboarding";
  if (context.role === "establishment") return "/etablissement";
  return context.onboarding_completed ? "/patient" : "/onboarding/identite";
}
function ProviderIcon({ provider }: { provider: string }) {
  if (provider === "google") return <svg aria-hidden="true" viewBox="0 0 24 24" className="provider-icon"><path fill="#4285F4" d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.2c1.9-1.8 3.1-4.4 3.1-7.5Z"/><path fill="#34A853" d="M12 22c2.8 0 5.2-.9 6.9-2.4l-3.2-2.6c-.9.6-2.1 1-3.7 1-2.8 0-5.2-1.9-6-4.5H2.7v2.7A10.4 10.4 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6 13.5a6.2 6.2 0 0 1 0-3.9V6.9H2.7a10.1 10.1 0 0 0 0 9.2L6 13.5Z"/><path fill="#EA4335" d="M12 5.1c1.5 0 2.8.5 3.8 1.5l2.8-2.8C17.2 2.1 14.8 1 12 1a10.4 10.4 0 0 0-9.3 5.9L6 9.5c.8-2.6 3.2-4.4 6-4.4Z"/></svg>;
  if (provider === "facebook") return <svg aria-hidden="true" viewBox="0 0 24 24" className="provider-icon"><path fill="currentColor" d="M13.5 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.6-1.5h1.7V3.9c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1V10H7.7v3H10v8h3.5Z"/></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="provider-icon"><path fill="currentColor" d="M16.7 12.7c0-2.1 1.7-3.1 1.8-3.2-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.4.8-.7 0-1.7-.8-2.8-.8-1.5 0-2.9.9-3.7 2.2-1.6 2.7-.4 6.7 1.1 8.9.8 1.1 1.6 2.3 2.8 2.2 1.1 0 1.6-.7 2.9-.7s1.7.7 2.9.7c1.2 0 2-.1 2.8-1.3.9-1.3 1.3-2.5 1.3-2.6-.1 0-2.5-1-2.5-2.5Z"/><path fill="currentColor" d="M15.1 6.7c.6-.8 1-1.9.9-3-.9 0-2 .6-2.6 1.3-.6.7-1 1.8-.9 2.9 1 0 2-.5 2.6-1.2Z"/></svg>;
}
export function AuthForms() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [form, setForm] = useState({ email: "", password: "", first_name: "", last_name: "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "register") setMode("register");
    if (params.has("oauth") && params.get("status") === "success") setMessage("Connexion réussie, ouverture de votre espace…");
    else setMessage(params.get("message") ?? "");
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage(mode === "login" ? "Connexion sécurisée en cours…" : "Création de votre compte…");
    try {
      const tokenResponse = await primeCsrf();
      const r = await fetch(`${API}/api/v1/identity/${mode}/`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRFToken": readCsrfToken() }, body: JSON.stringify(form) });
      const p = await r.json();
      if (!tokenResponse.ok || !r.ok) { setMessage(p.message ?? "Impossible de poursuivre. Vérifiez vos informations."); return; }
      router.replace(destinationFor(p.data ?? {}, mode, new URLSearchParams(window.location.search).get("next")));
    } catch { setMessage("Le service de connexion est momentanément inaccessible. Réessayez."); }
    finally { setBusy(false); }
  }
  const requested = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("next");
  const oauthNext = requested ? `?next=${encodeURIComponent(safeOAuthNext(requested))}` : "";
  return <div className="auth-card">
    <div className="auth-card__header"><p className="brand brand--compact"><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="6" y="3" width="12" height="18" rx="2"/><path d="M10 3v18M13 9h2"/></svg></span> E-carnet</p></div>
    <span className="eyebrow">Un accès unique à votre carnet</span>
    <h1>{mode === "login" ? "Bon retour parmi nous" : "Créer mon carnet"}</h1>
    <p className="auth-subtitle">{mode === "login" ? "Connectez-vous ou créez votre compte pour continuer." : "Votre compte sera prêt en quelques étapes."}</p>
    <div className="auth-mode-switch" role="group" aria-label="Type de compte">
      <button type="button" className={mode === "login" ? "is-selected" : ""} aria-pressed={mode === "login"} onClick={() => { setMode("login"); setMessage(""); }}>J’ai déjà un compte</button>
      <button type="button" className={mode === "register" ? "is-selected" : ""} aria-pressed={mode === "register"} onClick={() => { setMode("register"); setMessage(""); }}>Nouveau compte</button>
    </div>
    <div className="social-grid" aria-label="Méthodes de connexion">
      {(["google", "facebook", "apple"] as const).map(provider => <a className={`social-button social-button--${provider}`} key={provider} href={`${API}/api/v1/identity/oauth/${provider}/start/${oauthNext}`}><ProviderIcon provider={provider} /><span>{provider === "google" ? "Continuer avec Google" : provider === "facebook" ? "Continuer avec Facebook" : "Continuer avec Apple"}</span></a>)}
    </div>
    <div className="auth-divider"><span>ou avec mon e-mail</span></div>
    <form className="auth-form-body" onSubmit={submit}>
      {mode === "register" && <div className="auth-name-grid"><label className="field"><span>Prénom</span><input required autoComplete="given-name" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} /></label><label className="field"><span>Nom</span><input required autoComplete="family-name" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} /></label></div>}
      <label className="field"><span>Adresse e-mail</span><input type="email" required autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
      <label className="field"><span>Mot de passe</span><input type="password" required minLength={12} autoComplete={mode === "login" ? "current-password" : "new-password"} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label>
      <button className="button primary auth-submit" type="submit" disabled={busy}>{busy ? "Veuillez patienter…" : mode === "login" ? "Se connecter" : "Créer mon compte"}</button>
    </form>
    {message && <p className="auth-message" role="status">{message}</p>}
  </div>;
}
