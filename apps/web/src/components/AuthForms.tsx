"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { primeCsrf, readCsrfToken } from "../infrastructure/api/client";
import { safeOAuthNext } from "../lib/auth";
import { ModalIllustration } from "./modal/ModalIllustration";
import { useDialogBehavior } from "./modal/useDialogBehavior";
import { GooLayer } from "./ui/GooLayer";
import { useAuthUi, type AuthMode } from "./auth/AuthUiContext";
const API = "";
const PROVIDERS = ["google", "facebook", "apple"] as const;
const PROVIDER_LABEL = { google: "Google", facebook: "Facebook", apple: "Apple" } as const;
const SUCCESS_DELAY_MS = 1500;
const MOBILE_QUERY = "(max-width: 859px)";
type Account = { must_change_password?: boolean; recovery_configured?: boolean; contexts?: Array<{ role: string; is_active: boolean; onboarding_completed: boolean }> };
function destinationFor(account: Account, mode: AuthMode, requested: string | null) {
  // Mot de passe temporaire remis par l'équipe : rien d'autre n'est accessible avant de l'avoir remplacé.
  if (account.must_change_password) return "/connexion/nouveau-mot-de-passe";
  if (mode === "register") return requested === "/patient/transfert" ? requested : "/onboarding/identite";
  const context = account.contexts?.find((item) => item.is_active) ?? account.contexts?.[0];
  if (context?.onboarding_completed && !account.recovery_configured) return "/onboarding/securite";
  if (requested?.startsWith("/") && !requested.startsWith("//") && !requested.includes("\\")) return safeOAuthNext(requested);
  if (!context) return "/patient";
  if (context.role === "professional") return context.onboarding_completed ? "/professionnel" : "/professionnel/onboarding";
  if (context.role === "establishment") return context.onboarding_completed ? "/etablissement" : "/etablissement/fiche";
  return context.onboarding_completed ? "/patient" : "/onboarding/identite";
}
function ProviderIcon({ provider }: { provider: string }) {
  if (provider === "google") return <svg aria-hidden="true" viewBox="0 0 24 24" className="provider-icon"><path fill="#4285F4" d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.2c1.9-1.8 3.1-4.4 3.1-7.5Z"/><path fill="#34A853" d="M12 22c2.8 0 5.2-.9 6.9-2.4l-3.2-2.6c-.9.6-2.1 1-3.7 1-2.8 0-5.2-1.9-6-4.5H2.7v2.7A10.4 10.4 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6 13.5a6.2 6.2 0 0 1 0-3.9V6.9H2.7a10.1 10.1 0 0 0 0 9.2L6 13.5Z"/><path fill="#EA4335" d="M12 5.1c1.5 0 2.8.5 3.8 1.5l2.8-2.8C17.2 2.1 14.8 1 12 1a10.4 10.4 0 0 0-9.3 5.9L6 9.5c.8-2.6 3.2-4.4 6-4.4Z"/></svg>;
  if (provider === "facebook") return <svg aria-hidden="true" viewBox="0 0 24 24" className="provider-icon"><path fill="currentColor" d="M13.5 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.6-1.5h1.7V3.9c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1V10H7.7v3H10v8h3.5Z"/></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="provider-icon"><path fill="currentColor" d="M16.7 12.7c0-2.1 1.7-3.1 1.8-3.2-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.4.8-.7 0-1.7-.8-2.8-.8-1.5 0-2.9.9-3.7 2.2-1.6 2.7-.4 6.7 1.1 8.9.8 1.1 1.6 2.3 2.8 2.2 1.1 0 1.6-.7 2.9-.7s1.7.7 2.9.7c1.2 0 2-.1 2.8-1.3.9-1.3 1.3-2.5 1.3-2.6-.1 0-2.5-1-2.5-2.5Z"/><path fill="currentColor" d="M15.1 6.7c.6-.8 1-1.9.9-3-.9 0-2 .6-2.6 1.3-.6.7-1 1.8-.9 2.9 1 0 2-.5 2.6-1.2Z"/></svg>;
}
function EyeIcon({ off }: { off: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="ax-eye__icon"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{off && <path className="ax-eye__slash" d="M4 4l16 16" />}</svg>;
}

function Socials({ labeled, oauthNext }: { labeled: boolean; oauthNext: string }) {
  return <div className={`ax-socials${labeled ? " ax-socials--labeled" : ""}`} role="group" aria-label="Méthodes de connexion">
    {PROVIDERS.map((provider) => <a className={`button ax-social ax-social--${provider}`} key={provider} data-ax-item href={`${API}/api/v1/identity/oauth/${provider}/start/${oauthNext}`} aria-label={`Continuer avec ${PROVIDER_LABEL[provider]}`}><ProviderIcon provider={provider} />{labeled && <span>Continuer avec {PROVIDER_LABEL[provider]}</span>}</a>)}
  </div>;
}

export function AuthForms() {
  const router = useRouter();
  const { mode, setMode, step, setStep, status, setStatus, setFirstName } = useAuthUi();
  const [form, setForm] = useState({ email: "", password: "", first_name: "", last_name: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [errorModal, setErrorModal] = useState("");
  const firstField = useRef<HTMLInputElement>(null);
  const focusAfterStep = useRef(false);
  const redirectTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      // Quelqu'un qui arrive avec une intention claire (inscription, retour d'une page protégée, retour OAuth) va droit au formulaire.
      if (params.get("mode") === "register") { setMode("register"); setStep("form"); }
      if (params.has("next") || params.has("message") || params.has("oauth")) setStep("form");
      if (params.has("oauth") && params.get("status") === "success") setMessage("Connexion réussie, ouverture de votre espace…");
      else if (params.has("oauth") && params.get("status") !== "success") { setErrorModal(params.get("message") || "La connexion avec ce fournisseur n’a pas abouti. Réessayez ou choisissez une autre méthode."); setStatus("error"); }
      else if (params.get("message")) { setErrorModal(params.get("message") ?? ""); setStatus("error"); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [setMode, setStep, setStatus]);

  useEffect(() => () => window.clearTimeout(redirectTimer.current), []);

  // Sur mobile, le focus suit le geste (« Créer mon carnet », « Se connecter ») ; jamais au chargement, pour ne pas ouvrir le clavier.
  useEffect(() => {
    if (step === "form" && focusAfterStep.current && window.matchMedia(MOBILE_QUERY).matches) firstField.current?.focus();
    focusAfterStep.current = false;
  }, [step, mode]);

  function openForm(next: AuthMode) { focusAfterStep.current = true; setMode(next); setStep("form"); setMessage(""); setStatus("idle"); }
  function switchMode(next: AuthMode) { focusAfterStep.current = true; setMode(next); setMessage(""); setStatus("idle"); }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (status === "busy" || status === "success") return;
    setStatus("busy"); setErrorModal(""); setMessage(mode === "login" ? "Connexion sécurisée en cours…" : "Création de votre compte…");
    try {
      const tokenResponse = await primeCsrf();
      const r = await fetch(`${API}/api/v1/identity/${mode}/`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRFToken": readCsrfToken() }, body: JSON.stringify(form) });
      const p = await r.json().catch(() => ({}));
      if (!tokenResponse.ok || !r.ok) {
        const detail = p.message ?? p.detail ?? (r.status === 401 ? "Adresse e-mail ou mot de passe incorrect. Vérifiez vos informations et réessayez." : r.status === 429 ? "Trop de tentatives. Patientez quelques minutes avant de réessayer." : "La demande n’a pas abouti. Vérifiez les informations saisies puis réessayez.");
        setMessage(""); setStatus("error"); setErrorModal(typeof detail === "string" ? detail : "Certains champs sont invalides. Vérifiez vos informations."); return;
      }
      // Le personnage de la scène te salue par ton prénom avant l'ouverture de l'espace (aucune attente en mouvement réduit).
      const account = (p.data ?? {}) as Account & { first_name?: string };
      setFirstName((account.first_name ?? form.first_name).trim());
      setStatus("success"); setMessage("Bienvenue ! Ouverture de votre espace…");
      const destination = destinationFor(account, mode, new URLSearchParams(window.location.search).get("next"));
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      redirectTimer.current = window.setTimeout(() => router.replace(destination), calm ? 0 : SUCCESS_DELAY_MS);
    } catch { setMessage(""); setStatus("error"); setErrorModal("Le service de connexion est momentanément inaccessible. Vérifiez votre connexion puis réessayez."); }
  }

  const requested = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("next");
  const oauthNext = `?intent=login${requested ? `&next=${encodeURIComponent(safeOAuthNext(requested))}` : ""}`;
  const busy = status === "busy" || status === "success";
  const strength = Math.min(form.password.length / 12, 1);
  const login = mode === "login";

  return <div className="ax-card" data-mode={mode} data-step={step} data-status={status}>
    <div className="ax-welcome-actions" aria-hidden={step !== "welcome" ? true : undefined}>
      <button type="button" className="button primary ax-pill" data-ax-item onClick={() => openForm("register")}>Créer mon carnet</button>
      <div className="ax-divider" data-ax-item><span>ou</span></div>
      <Socials labeled oauthNext={oauthNext} />
      <p className="ax-switch" data-ax-item>Vous avez déjà un compte ? <button type="button" onClick={() => openForm("login")}>Se connecter</button></p>
    </div>

    <form className="ax-form" onSubmit={submit} aria-busy={busy}>
      <div className="ax-form__top">
        <button type="button" className="ax-back" onClick={() => { setStep("welcome"); setStatus("idle"); setMessage(""); }}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M19 12H6M11 6l-6 6 6 6" /></svg>Retour</button>
        <svg className="ax-glyph" aria-hidden="true" viewBox="0 0 24 24"><path d="M12 2.5v19M3.8 7.2l16.4 9.6M20.2 7.2 3.8 16.8" /></svg>
      </div>
      <h2 className="ax-title" key={mode}>{login ? "Bon retour parmi nous" : "Créer mon carnet"}</h2>
      <p className="ax-subtitle">{login ? "Connectez-vous pour retrouver votre carnet et vos accès." : "Votre compte sera prêt en quelques secondes."}</p>
      {!login && <div className="ax-names">
        <label className="ax-field" data-ax-item><span>Prénom</span><input required autoComplete="given-name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></label>
        <label className="ax-field" data-ax-item><span>Nom</span><input required autoComplete="family-name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></label>
      </div>}
      <label className="ax-field" data-ax-item><span>Adresse e-mail</span><input ref={firstField} type="email" required autoComplete="email" placeholder="vous@exemple.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
      <label className="ax-field" data-ax-item><span>Mot de passe</span>
        <span className="ax-password">
          <input type={showPassword ? "text" : "password"} required minLength={login ? undefined : 12} autoComplete={login ? "current-password" : "new-password"} aria-describedby={login ? undefined : "auth-password-hint"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <button type="button" className="ax-eye" aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}><EyeIcon off={showPassword} /></button>
        </span>
        {!login && <><span className="ax-meter" aria-hidden="true"><i data-full={strength >= 1} style={{ transform: `scaleX(${strength})` }} /></span><small id="auth-password-hint" className="ax-hint">12 caractères minimum ({Math.min(form.password.length, 12)}/12). Choisissez un mot de passe que vous n’utilisez pas ailleurs.</small></>}
      </label>
      {login && <p className="ax-forgot" data-ax-item><Link href="/connexion/recuperation">Récupérer mon compte</Link></p>}
      <button className={`button primary ax-submit${status === "busy" ? " is-loading" : ""}`} type="submit" disabled={busy} data-ax-item><span className="ax-submit__label">{status === "success" ? "Bienvenue !" : busy ? "Connexion sécurisée…" : login ? "Se connecter" : "Créer mon compte"}</span><svg className="ax-submit__arrow" aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6" /></svg><span className="ax-submit__spinner" aria-hidden="true" /></button>
      <div className="ax-divider" data-ax-item><span>ou continuer avec</span></div>
      <Socials labeled={false} oauthNext={oauthNext} />
      <p className="ax-switch" data-ax-item>{login ? "Pas encore de compte ?" : "Vous avez déjà un compte ?"} <button type="button" onClick={() => switchMode(login ? "register" : "login")}>{login ? "Créer mon carnet" : "Se connecter"}</button></p>
      <p className="ax-message" role="status" aria-live="polite" hidden={!message}>{message}</p>
    </form>
    {errorModal && createPortal(<AuthErrorDialog message={errorModal} title={login ? "Connexion impossible" : "Création impossible"} onClose={() => { setErrorModal(""); setStatus("idle"); }} />, document.body)}
  </div>;
}

function AuthErrorDialog({ title, message, onClose }: { title: string; message: string; onClose: () => void }) {
  const dialog = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useDialogBehavior({ open: true, container: dialog, initialFocus: closeButton, onEscape: onClose });
  return <div className="modal-backdrop modal-backdrop--confirm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialog} className="modal-dialog modal-confirm" data-tone="danger" role="alertdialog" aria-modal="true" aria-labelledby={titleId}>
      <ModalIllustration mood="oops" size="md" />
      <div className="modal-copy"><h2 id={titleId}>{title}</h2><p className="modal-message">{message}</p></div>
      <div className="modal-actions modal-actions--single"><button ref={closeButton} type="button" className="button primary" onClick={onClose}>Compris</button></div>
    </section>
    <GooLayer target={dialog} />
  </div>;
}
