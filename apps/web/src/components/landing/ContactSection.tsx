"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { ApiError, apiPost } from "../../infrastructure/api/client";
import {
  CONTACT_LIMITS,
  CONTACT_SUBJECTS,
  EMPTY_CONTACT,
  contactPayload,
  fieldErrorsFromApi,
  isContactSubject,
  subjectFromQuery,
  validateConsent,
  validateContact,
  validateContactValue,
  validateMessage,
  validateName,
  type ContactErrors,
  type ContactField,
  type ContactFields,
  type ContactSubject,
} from "../../lib/contact";
import { CONTACT_COPY } from "../../lib/landing-content";
import { Icon } from "../ui/Icon";

type Status = "idle" | "sending" | "sent";

const FIELD_ORDER: ContactField[] = ["firstName", "lastName", "contact", "subject", "message", "consent"];
type TextField = Exclude<ContactField, "consent">;
const FIELD_VALIDATORS: Record<ContactField, (fields: ContactFields) => string | undefined> = {
  firstName: (fields) => validateName(fields.firstName, "Prénom"),
  lastName: (fields) => validateName(fields.lastName, "Nom"),
  contact: (fields) => validateContactValue(fields.contact),
  subject: (fields) => (isContactSubject(fields.subject) ? undefined : "Choisissez l’objet de votre message."),
  message: (fields) => validateMessage(fields.message),
  consent: (fields) => validateConsent(fields.consent),
};

const noopSubscribe = () => () => {};
/** Objet demandé par l'adresse (?objet=establishment). Vide côté serveur : la valeur n'apparaît qu'après l'hydratation, sans écart d'affichage. */
const readQuerySubject = () => subjectFromQuery(new URLSearchParams(window.location.search).get("objet"));

function failureMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) return "Trop d’envois pour le moment. Patientez un peu, puis réessayez.";
    if (error.status >= 500) return "Le service ne répond pas pour le moment. Votre message n’a pas été envoyé : réessayez dans quelques instants.";
    return error.message;
  }
  return "Connexion impossible. Vérifiez votre réseau : votre message n’a pas été envoyé.";
}

export function ContactSection({ privacyHref }: { privacyHref: string }) {
  const [fields, setFields] = useState<ContactFields>(EMPTY_CONTACT);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [touched, setTouched] = useState<Partial<Record<ContactField, boolean>>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [failure, setFailure] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const decoy = useRef<HTMLInputElement>(null);
  const successTitle = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const fieldId = (field: ContactField) => `${id}-${field}`;

  // L'objet vient du choix du visiteur, sinon de l'adresse (/?objet=establishment#contact), sinon il reste à choisir.
  const querySubject = useSyncExternalStore<ContactSubject | "">(noopSubscribe, readQuerySubject, () => "");
  const current: ContactFields = { ...fields, subject: fields.subject || querySubject };

  // Un lien de la landing portant data-contact-subject (ex. « Contacter l'équipe ») présélectionne l'objet du formulaire.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.<HTMLAnchorElement>("a[data-contact-subject]");
      const chosen = subjectFromQuery(link?.dataset.contactSubject);
      if (!chosen) return;
      setStatus("idle");
      setFields((previous) => ({ ...previous, subject: chosen }));
      setErrors((previous) => ({ ...previous, subject: undefined }));
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Le formulaire change de hauteur (erreurs, message de succès) : la landing recalcule ses repères de défilement.
  const errorCount = Object.values(errors).filter(Boolean).length;
  useEffect(() => {
    const timer = window.setTimeout(() => window.dispatchEvent(new Event("ecarnet:layout")), 120);
    return () => window.clearTimeout(timer);
  }, [status, failure, errorCount]);

  useEffect(() => { if (status === "sent") successTitle.current?.focus(); }, [status]);

  function update(field: TextField) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const next = { ...current, [field]: event.target.value } as ContactFields;
      setFields(next);
      setFailure("");
      // Une erreur déjà affichée disparaît dès que la saisie devient valide ; on ne gronde pas pendant la frappe.
      if (errors[field] && !FIELD_VALIDATORS[field](next)) setErrors((current) => ({ ...current, [field]: undefined }));
    };
  }

  function toggleConsent(event: ChangeEvent<HTMLInputElement>) {
    setFields({ ...current, consent: event.target.checked });
    setFailure("");
    if (event.target.checked) setErrors((previous) => ({ ...previous, consent: undefined }));
  }

  function blur(field: TextField) {
    setTouched((current) => ({ ...current, [field]: true }));
    const message = FIELD_VALIDATORS[field](current);
    setErrors((current) => ({ ...current, [field]: message }));
  }

  function focusFirst(found: ContactErrors) {
    const first = FIELD_ORDER.find((field) => found[field]);
    if (first) form.current?.querySelector<HTMLElement>(`#${CSS.escape(fieldId(first))}`)?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;
    const found = validateContact(current);
    setTouched({ firstName: true, lastName: true, contact: true, subject: true, message: true, consent: true });
    setErrors(found);
    setFailure("");
    if (Object.keys(found).length) { focusFirst(found); return; }
    setStatus("sending");
    try {
      await apiPost<{ id: string }>("/api/v1/identity/contact/", contactPayload(current, decoy.current?.value ?? ""));
      setFields(EMPTY_CONTACT);
      setTouched({});
      setStatus("sent");
    } catch (error) {
      setStatus("idle");
      const serverErrors = error instanceof ApiError ? fieldErrorsFromApi((error.details as { errors?: unknown } | undefined)?.errors) : {};
      if (Object.keys(serverErrors).length) { setErrors(serverErrors); focusFirst(serverErrors); }
      setFailure(failureMessage(error));
    }
  }

  const shown = (field: ContactField) => (touched[field] ? errors[field] : undefined);
  const describe = (field: ContactField, ...extra: string[]) => [shown(field) ? `${fieldId(field)}-error` : "", ...extra].filter(Boolean).join(" ") || undefined;
  const remaining = CONTACT_LIMITS.messageMax - fields.message.length;
  const sending = status === "sending";

  const fieldError = (field: ContactField) => shown(field) && <p className="field-error" id={`${fieldId(field)}-error`}>{shown(field)}</p>;

  return (
    <section className="lp-section lp-wrap lp-contact" id="contact" aria-labelledby="contact-title">
      <div className="lp-contact__layout">
        <div className="lp-contact__intro" data-reveal>
          <span className="eyebrow">{CONTACT_COPY.eyebrow}</span>
          <h2 id="contact-title">{CONTACT_COPY.title}</h2>
          <p className="lead">{CONTACT_COPY.lead}</p>
          <ul className="lp-contact__points">
            {CONTACT_COPY.points.map((point) => <li key={point.text}><span aria-hidden="true"><Icon name={point.icon} size={18} /></span>{point.text}</li>)}
          </ul>
        </div>

        <div className="lp-contact__panel" data-reveal>
          {status === "sent" ? (
            <div className="lp-contact__done" role="status">
              <span className="lp-contact__done-icon" aria-hidden="true"><Icon name="check" size={26} /></span>
              <h3 ref={successTitle} tabIndex={-1}>Message envoyé</h3>
              <p>Merci. Nous vous répondons par le moyen que vous avez indiqué.</p>
              <button type="button" className="button" onClick={() => { setStatus("idle"); setFailure(""); }}>Écrire un autre message</button>
            </div>
          ) : (
            <form ref={form} className="lp-contact__form" onSubmit={submit} noValidate aria-busy={sending}>
              <div className="lp-contact__row">
                <div className={`field${shown("firstName") ? " field--error" : ""}`}>
                  <label htmlFor={fieldId("firstName")}>Prénom</label>
                  <input id={fieldId("firstName")} name="given-name" autoComplete="given-name" required maxLength={CONTACT_LIMITS.nameMax} value={fields.firstName} onChange={update("firstName")} onBlur={() => blur("firstName")} aria-invalid={Boolean(shown("firstName"))} aria-describedby={describe("firstName")} />
                  {fieldError("firstName")}
                </div>
                <div className={`field${shown("lastName") ? " field--error" : ""}`}>
                  <label htmlFor={fieldId("lastName")}>Nom</label>
                  <input id={fieldId("lastName")} name="family-name" autoComplete="family-name" required maxLength={CONTACT_LIMITS.nameMax} value={fields.lastName} onChange={update("lastName")} onBlur={() => blur("lastName")} aria-invalid={Boolean(shown("lastName"))} aria-describedby={describe("lastName")} />
                  {fieldError("lastName")}
                </div>
              </div>

              <div className={`field${shown("contact") ? " field--error" : ""}`}>
                <label htmlFor={fieldId("contact")}>E-mail ou numéro de téléphone</label>
                <input id={fieldId("contact")} name="contact" type="text" inputMode="text" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={CONTACT_LIMITS.emailMax} placeholder="vous@exemple.com ou 07 00 00 00 00" value={fields.contact} onChange={update("contact")} onBlur={() => blur("contact")} aria-invalid={Boolean(shown("contact"))} aria-describedby={describe("contact", `${fieldId("contact")}-hint`)} />
                <p className="field-hint" id={`${fieldId("contact")}-hint`}>Nous vous répondons par ce moyen.</p>
                {fieldError("contact")}
              </div>

              <div className={`field${shown("subject") ? " field--error" : ""}`}>
                <label htmlFor={fieldId("subject")}>Objet du message</label>
                <div className="lp-select">
                  <select id={fieldId("subject")} name="subject" required value={current.subject} onChange={update("subject")} onBlur={() => blur("subject")} aria-invalid={Boolean(shown("subject"))} aria-describedby={describe("subject")}>
                    <option value="" disabled>Choisir un objet</option>
                    {CONTACT_SUBJECTS.map((subject) => <option key={subject.value} value={subject.value}>{subject.label}</option>)}
                  </select>
                  <Icon name="chevron" size={16} className="lp-select__chevron" />
                </div>
                {fieldError("subject")}
              </div>

              <div className={`field${shown("message") ? " field--error" : ""}`}>
                <label htmlFor={fieldId("message")}>Message</label>
                <textarea id={fieldId("message")} name="message" rows={6} required maxLength={CONTACT_LIMITS.messageMax + 200} placeholder="Décrivez votre besoin en quelques lignes." value={fields.message} onChange={update("message")} onBlur={() => blur("message")} aria-invalid={Boolean(shown("message"))} aria-describedby={describe("message", `${fieldId("message")}-count`)} />
                <div className="lp-contact__meta">
                  {fieldError("message") ?? <span />}
                  <small id={`${fieldId("message")}-count`} className={remaining < 0 ? "is-over" : remaining < 100 ? "is-near" : undefined}>{fields.message.length} / {CONTACT_LIMITS.messageMax.toLocaleString("fr-FR")}</small>
                </div>
              </div>

              <div className="lp-hp" aria-hidden="true"><label>Ne pas remplir<input ref={decoy} type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" /></label></div>

              <p className="lp-contact__warning"><Icon name="shield" size={16} />Version pilote : n’écrivez aucune information de santé réelle.</p>

              <div className={`lp-contact__consent${shown("consent") ? " is-error" : ""}`}>
                <label htmlFor={fieldId("consent")}>
                  <input id={fieldId("consent")} name="consent" type="checkbox" required checked={fields.consent} onChange={toggleConsent} aria-invalid={Boolean(shown("consent"))} aria-describedby={describe("consent")} />
                  <span>J’ai lu la <Link href={privacyHref} target="_blank" rel="noreferrer">politique de confidentialité</Link> et j’accepte que mon nom, ma coordonnée et mon message soient enregistrés pour que l’équipe puisse me répondre.</span>
                </label>
                {fieldError("consent")}
              </div>

              {failure && <p className="notice notice--error" role="alert">{failure}</p>}

              <button className="button primary lp-contact__submit" type="submit" disabled={sending}>{sending ? "Envoi en cours…" : "Envoyer mon message"}</button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
