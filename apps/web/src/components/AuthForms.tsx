"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { primeCsrf, readCsrfToken } from "../infrastructure/api/client";
import { safeOAuthNext } from "../lib/auth";
import { BrandMark } from "./ui/BrandMark";
import { ModalIllustration } from "./modal/ModalIllustration";
import { useDialogBehavior } from "./modal/useDialogBehavior";
const API = "";
type AuthMode = "login" | "register";
type Account = { recovery_configured?: boolean; contexts?: Array<{ role: string; is_active: boolean; onboarding_completed: boolean }> };
function destinationFor(account: Account, mode: AuthMode, requested: string | null) {
  if (mode === "register") return "/onboarding/identite";
  const context = account.contexts?.find((item) => item.is_active) ?? account.contexts?.[0];
  if (context?.onboarding_completed && !account.recovery_configured) return "/onboarding/securite";
  if (requested?.startsWith("/") && !requested.startsWith("//") && !requested.includes("\\")) return safeOAuthNext(requested);
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
  const [errorModal, setErrorModal] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("mode") === "register") setMode("register");
      if (params.has("oauth") && params.get("status") === "success") setMessage("Connexion réussie, ouverture de votre espace…");
      else if (params.has("oauth") && params.get("status") !== "success") setErrorModal(params.get("message") || "La connexion avec ce fournisseur n’a pas abouti. Réessayez ou choisissez une autre méthode.");
      else if (params.get("message")) setErrorModal(params.get("message") ?? "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErrorModal(""); setMessage(mode === "login" ? "Connexion sécurisée en cours…" : "Création de votre compte…");
    try {
      const tokenResponse = await primeCsrf();
      const r = await fetch(`${API}/api/v1/identity/${mode}/`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRFToken": readCsrfToken() }, body: JSON.stringify(form) });
      const p = await r.json().catch(() => ({}));
      if (!tokenResponse.ok || !r.ok) {
        const detail = p.message ?? p.detail ?? (r.status === 401 ? "Adresse e-mail ou mot de passe incorrect. Vérifiez vos informations et réessayez." : r.status === 429 ? "Trop de tentatives. Patientez quelques minutes avant de réessayer." : "La demande n’a pas abouti. Vérifiez les informations saisies puis réessayez.");
        setMessage(""); setErrorModal(typeof detail === "string" ? detail : "Certains champs sont invalides. Vérifiez vos informations."); return;
      }
      router.replace(destinationFor(p.data ?? {}, mode, new URLSearchParams(window.location.search).get("next")));
    } catch { setMessage(""); setErrorModal("Le service de connexion est momentanément inaccessible. Vérifiez votre connexion puis réessayez."); }
    finally { setBusy(false); }
  }
  const requested = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("next");
  const oauthNext = `?intent=login${requested ? `&next=${encodeURIComponent(safeOAuthNext(requested))}` : ""}`;
  return <div className="auth-card" data-mode={mode}>
    <div className="auth-card__header"><p className="brand brand--compact"><BrandMark /> E-carnet</p></div>
    <span className="eyebrow">Un accès unique à votre carnet</span>
    <h2 className="auth-card__title">{mode === "login" ? "Bon retour parmi nous" : "Créer mon carnet"}</h2>
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
      <label className="field"><span>Mot de passe</span><input type="password" required minLength={12} autoComplete={mode === "login" ? "current-password" : "new-password"} aria-describedby={mode === "register" ? "auth-password-hint" : undefined} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />{mode === "register" && <small id="auth-password-hint" className="auth-field-hint">12 caractères minimum. Choisissez un mot de passe que vous n’utilisez pas ailleurs.</small>}</label>
      <button className={`button primary auth-submit${busy ? " is-loading" : ""}`} type="submit" disabled={busy} aria-busy={busy}><span>{busy ? "Connexion sécurisée…" : mode === "login" ? "Se connecter" : "Créer mon compte"}</span><svg className="auth-submit__arrow" aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6" /></svg>{busy && <span className="auth-submit__spinner" aria-hidden="true" />}</button>
    </form>
    {message && <p className="auth-message" role="status">{message}</p>}
    {errorModal && <AuthErrorDialog message={errorModal} onClose={() => setErrorModal("")} />}
  </div>;
}

function AuthErrorDialog({ message, onClose }: { message: string; onClose: () => void }) {
  const dialog = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useDialogBehavior({ open: true, container: dialog, initialFocus: closeButton, onEscape: onClose });
  return <div className="modal-backdrop modal-backdrop--confirm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialog} className="modal-dialog modal-confirm" data-tone="danger" role="alertdialog" aria-modal="true" aria-labelledby={titleId}>
      <ModalIllustration mood="oops" size="md" />
      <div className="modal-copy"><h2 id={titleId}>Connexion impossible</h2><p className="modal-message">{message}</p></div>
      <div className="modal-actions modal-actions--single"><button ref={closeButton} type="button" className="button primary" onClick={onClose}>Compris</button></div>
    </section>
  </div>;
}
