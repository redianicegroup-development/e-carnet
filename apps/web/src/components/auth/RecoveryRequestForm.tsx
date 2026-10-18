"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, apiPost } from "../../infrastructure/api/client";
import { EMPTY_CONTACT, contactPayload, fieldErrorsFromApi, validateContact, type ContactErrors, type ContactField, type ContactFields } from "../../lib/contact";

/* Dernier recours de « Récupérer mon compte » : la personne ne se souvient plus de sa réponse secrète.
   La demande arrive dans la boîte de contact de l'équipe, qui vérifie la personne avant toute réouverture.
   Même apparence que la connexion (classes ax-*). */
const MARK = "[Récupération de compte] ";

export function RecoveryRequestForm({ onBack }: { onBack?: () => void } = {}) {
  const [fields, setFields] = useState<ContactFields>({ ...EMPTY_CONTACT, subject: "problem" });
  const [errors, setErrors] = useState<ContactErrors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [message, setMessage] = useState("");
  const decoy = useRef<HTMLInputElement>(null);
  const done = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (status === "sent") done.current?.focus(); }, [status]);

  function update<K extends ContactField>(key: K, value: ContactFields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (status === "sending") return;
    const found = validateContact(fields);
    setErrors(found);
    if (Object.keys(found).length) { setMessage("Vérifiez les champs signalés."); return; }
    setStatus("sending");
    setMessage("");
    try {
      await apiPost("/api/v1/identity/contact/", contactPayload({ ...fields, message: `${MARK}${fields.message.trim()}` }, decoy.current?.value ?? ""));
      setStatus("sent");
    } catch (error) {
      setStatus("idle");
      if (error instanceof ApiError && error.status === 429) setMessage("Trop d’envois pour le moment. Patientez un peu, puis réessayez.");
      else {
        const apiErrors = error instanceof ApiError ? fieldErrorsFromApi((error.details as { errors?: unknown } | undefined)?.errors) : {};
        setErrors(apiErrors);
        setMessage(Object.keys(apiErrors).length ? "Vérifiez les champs signalés." : "Votre demande n’a pas pu être envoyée. Réessayez dans un instant.");
      }
    }
  }

  if (status === "sent") return <div className="ax-card" data-step="form" data-status="success" role="status">
    <div className="ax-form">
      <h2 className="ax-title" tabIndex={-1} ref={done}>Demande envoyée</h2>
      <p className="ax-subtitle">L’équipe Mon E‑Carnet vous répondra à l’adresse ou au numéro indiqué pour vérifier votre identité. Aucun accès n’est rouvert avant cet échange.</p>
      <Link className="button primary ax-submit ax-submit--link" href="/connexion"><span className="ax-submit__label">Retour à la connexion</span></Link>
    </div>
  </div>;

  const sending = status === "sending";
  const fieldError = (key: ContactField) => errors[key] ? <small className="ax-error" id={`rec-${key}-error`} role="alert">{errors[key]}</small> : null;
  const invalid = (key: ContactField) => errors[key] ? { "aria-invalid": true, "aria-describedby": `rec-${key}-error` } : {};
  return <div className="ax-card" data-step="form" data-status={status === "sending" ? "busy" : "idle"}>
    <form className="ax-form" onSubmit={submit} aria-busy={sending} noValidate>
      <div className="ax-form__top">{onBack ? <button type="button" className="ax-back ax-back--always" onClick={onBack}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M19 12H6M11 6l-6 6 6 6" /></svg>Retour</button> : <Link className="ax-back ax-back--always" href="/connexion"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M19 12H6M11 6l-6 6 6 6" /></svg>Connexion</Link>}</div>
      <h2 className="ax-title">Écrire à l’équipe</h2>
      <p className="ax-subtitle">Vous ne vous souvenez plus de votre réponse ? Dites-nous comment vous joindre : l’équipe vérifie votre identité avant de rouvrir l’accès.</p>
      <div className="ax-names">
        <label className="ax-field" data-ax-item><span>Prénom</span><input required autoComplete="given-name" value={fields.firstName} onChange={(e) => update("firstName", e.target.value)} {...invalid("firstName")} />{fieldError("firstName")}</label>
        <label className="ax-field" data-ax-item><span>Nom</span><input required autoComplete="family-name" value={fields.lastName} onChange={(e) => update("lastName", e.target.value)} {...invalid("lastName")} />{fieldError("lastName")}</label>
      </div>
      <label className="ax-field" data-ax-item><span>E-mail ou téléphone pour vous joindre</span><input required autoComplete="email" inputMode="email" placeholder="vous@exemple.com ou 07 00 00 00 00" value={fields.contact} onChange={(e) => update("contact", e.target.value)} {...invalid("contact")} />{fieldError("contact")}</label>
      <label className="ax-field" data-ax-item><span>Que s’est-il passé ?</span><textarea required rows={4} maxLength={1900} placeholder="Ex. je n’arrive plus à me connecter, je ne me souviens plus de mon mot de passe." value={fields.message} onChange={(e) => update("message", e.target.value)} {...invalid("message")} />{fieldError("message")}</label>
      <label className="ax-check" data-ax-item><input type="checkbox" checked={fields.consent} onChange={(e) => update("consent", e.target.checked)} {...invalid("consent")} /><span>J’accepte que l’équipe utilise ces informations pour répondre à ma demande.</span></label>
      {fieldError("consent")}
      <p className="ax-note" data-ax-item>N’écrivez jamais votre mot de passe ni d’information de santé dans ce message.</p>
      <div className="ax-hp" aria-hidden="true"><label>Ne pas remplir<input ref={decoy} type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" /></label></div>
      <button className={`button primary ax-submit${sending ? " is-loading" : ""}`} type="submit" disabled={sending} data-ax-item><span className="ax-submit__label">{sending ? "Envoi en cours…" : "Envoyer ma demande"}</span><svg className="ax-submit__arrow" aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6" /></svg><span className="ax-submit__spinner" aria-hidden="true" /></button>
      <p className="ax-message" role="status" aria-live="polite" hidden={!message}>{message}</p>
    </form>
  </div>;
}
