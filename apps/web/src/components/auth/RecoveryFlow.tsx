"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, apiPost } from "../../infrastructure/api/client";
import { RecoveryRequestForm } from "./RecoveryRequestForm";

/* « Récupérer mon compte » : deux étapes, même cadre que la connexion (classes ax-*).
   1. l'adresse du compte → sa question secrète ; 2. la réponse + un nouveau mot de passe.
   Tant que l'OTP n'existe pas, la bonne réponse suffit ; l'OTP viendra la confirmer (voir api identity/recovery.py).
   Le serveur répond de la même façon pour une adresse inconnue : cet écran ne révèle jamais si un compte existe.
   Sans réponse, le dernier recours reste d'écrire à l'équipe (RecoveryRequestForm). */
type Step = "email" | "answer" | "password" | "done" | "help";
const MIN_PASSWORD = 12;

function messageFrom(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.status === 429) return "Trop de tentatives pour le moment. Patientez un peu, puis réessayez.";
  return error instanceof Error && error.message ? error.message : fallback;
}

export function RecoveryFlow() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  // Le focus passe au titre à chaque changement d'étape (lecteurs d'écran), mais pas au premier affichage de la page.
  useEffect(() => { if (firstRender.current) { firstRender.current = false; return; } heading.current?.focus(); }, [step]);

  async function askQuestion(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!email.trim()) { setMessage("Saisissez l’adresse e-mail de votre compte."); return; }
    setBusy(true);
    setMessage("");
    try {
      const data = await apiPost<{ question: string }>("/api/v1/identity/recovery/question/", { email: email.trim() });
      setQuestion(data.question);
      setStep("answer");
    } catch (error) { setMessage(messageFrom(error, "Impossible de continuer pour le moment. Réessayez dans un instant.")); }
    finally { setBusy(false); }
  }

  async function verifyAnswer(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!answer.trim()) { setMessage("Saisissez votre réponse."); return; }
    setBusy(true); setMessage("");
    try {
      await apiPost("/api/v1/identity/recovery/answer/", { email: email.trim(), answer });
      setStep("password");
    } catch (error) { setMessage(messageFrom(error, "La réponse n’a pas pu être vérifiée. Réessayez.")); }
    finally { setBusy(false); }
  }
  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (password.length < MIN_PASSWORD) { setMessage(`Le nouveau mot de passe doit contenir au moins ${MIN_PASSWORD} caractères.`); return; }
    if (password !== confirm) { setMessage("Les deux mots de passe ne sont pas identiques."); return; }
    setBusy(true);
    setMessage("");
    try {
      await apiPost("/api/v1/identity/recovery/reset/", { email: email.trim(), answer, new_password: password });
      setAnswer(""); setPassword(""); setConfirm("");
      setStep("done");
    } catch (error) { setMessage(messageFrom(error, "Le mot de passe n’a pas pu être changé. Réessayez dans un instant.")); }
    finally { setBusy(false); }
  }

  if (step === "help") return <RecoveryRequestForm onBack={() => setStep("answer")} />;

  if (step === "done") return <div className="ax-card" data-step="form" data-status="success" role="status">
    <div className="ax-form">
      <h2 className="ax-title" tabIndex={-1} ref={heading}>Mot de passe modifié</h2>
      <p className="ax-subtitle">Vous pouvez vous connecter avec votre nouveau mot de passe. Par sécurité, vos autres appareils ont été déconnectés et un e-mail vous a été envoyé.</p>
      <Link className="ax-submit ax-submit--link" href="/connexion"><span className="ax-submit__label">Me connecter</span></Link>
    </div>
  </div>;

  const back = step === "answer" || step === "password"
    ? <button type="button" className="ax-back ax-back--always" onClick={() => { setStep("email"); setMessage(""); setAnswer(""); }}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M19 12H6M11 6l-6 6 6 6" /></svg>Changer d’adresse</button>
    : <Link className="ax-back ax-back--always" href="/connexion"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M19 12H6M11 6l-6 6 6 6" /></svg>Connexion</Link>;

  return <div className="ax-card" data-step="form" data-status={busy ? "busy" : "idle"}>
    {step === "email" ? <form className="ax-form" onSubmit={askQuestion} aria-busy={busy} noValidate>
      <div className="ax-form__top">{back}</div>
      <h2 className="ax-title" tabIndex={-1} ref={heading}>Récupérer mon compte</h2>
      <p className="ax-subtitle">Saisissez l’adresse e-mail de votre compte : nous vous poserons la question secrète que vous avez choisie.</p>
      <label className="ax-field" data-ax-item><span>Adresse e-mail</span><input type="email" required autoComplete="email" inputMode="email" value={email} onChange={(event) => { setEmail(event.target.value); setMessage(""); }} placeholder="vous@exemple.com" /></label>
      <button className={`ax-submit${busy ? " is-loading" : ""}`} type="submit" disabled={busy} data-ax-item><span className="ax-submit__label">{busy ? "Un instant…" : "Continuer"}</span><svg className="ax-submit__arrow" aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6" /></svg><span className="ax-submit__spinner" aria-hidden="true" /></button>
      <p className="ax-message" role="status" aria-live="polite" hidden={!message}>{message}</p>
      <p className="ax-note" data-ax-item>Inscrit avec Google, Facebook ou Apple ? Essayez d’abord de vous <Link href="/connexion">reconnecter avec ce même fournisseur</Link>.</p>
    </form> : step === "answer" ? <form className="ax-form" onSubmit={verifyAnswer} aria-busy={busy} noValidate>
      <div className="ax-form__top">{back}</div>
      <h2 className="ax-title" tabIndex={-1} ref={heading}>Vérifier votre réponse</h2>
      <p className="ax-question" data-ax-item><span>Votre question secrète</span><strong>{question}</strong></p>
      <label className="ax-field" data-ax-item><span>Votre réponse</span><input required autoComplete="off" autoCapitalize="off" spellCheck={false} value={answer} onChange={(event) => { setAnswer(event.target.value); setMessage(""); }} /></label>
      <button className={`ax-submit${busy ? " is-loading" : ""}`} type="submit" disabled={busy} data-ax-item><span className="ax-submit__label">{busy ? "Vérification…" : "Valider ma réponse"}</span><svg className="ax-submit__arrow" aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6" /></svg></button>
      <p className="ax-message" role="status" aria-live="polite" hidden={!message}>{message}</p>
      <button type="button" className="ax-linkbutton" onClick={() => { setStep("help"); setMessage(""); }}>Je ne me souviens plus de ma réponse</button>
    </form> : <form className="ax-form" onSubmit={resetPassword} aria-busy={busy} noValidate>
      <div className="ax-form__top">{back}</div>
      <h2 className="ax-title" tabIndex={-1} ref={heading}>Nouveau mot de passe</h2>
      <p className="ax-subtitle">Réponse vérifiée. Choisissez maintenant votre nouveau mot de passe.</p>
      <label className="ax-field" data-ax-item><span>Nouveau mot de passe ({MIN_PASSWORD} caractères minimum)</span><input required type={show ? "text" : "password"} autoComplete="new-password" minLength={MIN_PASSWORD} value={password} onChange={(event) => { setPassword(event.target.value); setMessage(""); }} /></label>
      <label className="ax-field" data-ax-item><span>Confirmer le mot de passe</span><input required type={show ? "text" : "password"} autoComplete="new-password" minLength={MIN_PASSWORD} value={confirm} onChange={(event) => { setConfirm(event.target.value); setMessage(""); }} /></label>
      <label className="ax-check" data-ax-item><input type="checkbox" checked={show} onChange={(event) => setShow(event.target.checked)} /><span>Afficher les mots de passe</span></label>
      <button className={`ax-submit${busy ? " is-loading" : ""}`} type="submit" disabled={busy} data-ax-item><span className="ax-submit__label">{busy ? "Enregistrement…" : "Changer mon mot de passe"}</span><svg className="ax-submit__arrow" aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6" /></svg><span className="ax-submit__spinner" aria-hidden="true" /></button>
      <p className="ax-message" role="status" aria-live="polite" hidden={!message}>{message}</p>
      <p className="ax-note" data-ax-item>Après plusieurs réponses fausses, la récupération se bloque temporairement.</p>
    </form>}
  </div>;
}
