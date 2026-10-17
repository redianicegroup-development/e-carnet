/* Formulaire de contact de la landing : règles de validation, partagées par le formulaire et les tests.
   Elles reprennent celles de l'API (apps/api/apps/identity/contact_views.py) pour que le visiteur voie l'erreur avant
   l'envoi ; l'API reste la seule source de vérité et revalide tout. Aucun import : ce fichier doit rester testable seul. */

export const CONTACT_SUBJECTS = [
  { value: "question", label: "Une question sur Mon E-Carnet" },
  { value: "patient", label: "Je suis patient : besoin d’aide" },
  { value: "professional", label: "Je suis professionnel de santé" },
  { value: "establishment", label: "Ouvrir un espace établissement" },
  { value: "problem", label: "Signaler un problème" },
  { value: "privacy", label: "Mes données personnelles" },
  { value: "partnership", label: "Partenariat ou presse" },
  { value: "other", label: "Autre demande" },
] as const;

export type ContactSubject = (typeof CONTACT_SUBJECTS)[number]["value"];

export const CONTACT_LIMITS = {
  nameMin: 2,
  nameMax: 80,
  messageMin: 10,
  messageMax: 2000,
  emailMax: 254,
  phoneDigitsMin: 8,
  phoneDigitsMax: 15,
} as const;

export type ContactFields = {
  firstName: string;
  lastName: string;
  contact: string;
  subject: ContactSubject | "";
  message: string;
  /** Case de consentement : l'envoi est impossible tant qu'elle n'est pas cochée (l'API l'exige aussi). */
  consent: boolean;
};
export type ContactField = keyof ContactFields;
export type ContactErrors = Partial<Record<ContactField, string>>;

export const EMPTY_CONTACT: ContactFields = { firstName: "", lastName: "", contact: "", subject: "", message: "", consent: false };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_ALLOWED = /^\+?[0-9 ().-]+$/;
const KNOWN_SUBJECTS: readonly string[] = CONTACT_SUBJECTS.map((item) => item.value);

export const isContactSubject = (value: unknown): value is ContactSubject => typeof value === "string" && KNOWN_SUBJECTS.includes(value);

/** Espaces superflus retirés, comme le fait l'API. */
export const collapseSpaces = (value: string) => value.trim().split(/\s+/).filter(Boolean).join(" ");

/** « @ » → adresse e-mail, sinon numéro de téléphone. Même règle que l'API. */
export const contactKind = (value: string): "email" | "phone" => (value.includes("@") ? "email" : "phone");

export function validateName(value: string, label: string): string | undefined {
  const clean = collapseSpaces(value);
  if (clean.length < CONTACT_LIMITS.nameMin || clean.length > CONTACT_LIMITS.nameMax) {
    return `${label} : entre ${CONTACT_LIMITS.nameMin} et ${CONTACT_LIMITS.nameMax} caractères.`;
  }
  return undefined;
}

export function validateContactValue(value: string): string | undefined {
  const clean = value.trim();
  if (!clean) return "Indiquez une adresse e-mail ou un numéro de téléphone.";
  if (contactKind(clean) === "email") {
    if (clean.length > CONTACT_LIMITS.emailMax) return "Cette adresse e-mail est trop longue.";
    return EMAIL_PATTERN.test(clean) ? undefined : "Cette adresse e-mail n’est pas valide. Exemple : prenom@exemple.com.";
  }
  if (!PHONE_ALLOWED.test(clean)) return "Ce numéro n’est pas valide. Utilisez des chiffres, par exemple 07 00 00 00 00.";
  const digits = clean.replace(/\D/g, "").length;
  if (digits < CONTACT_LIMITS.phoneDigitsMin || digits > CONTACT_LIMITS.phoneDigitsMax) {
    return `Un numéro de téléphone compte entre ${CONTACT_LIMITS.phoneDigitsMin} et ${CONTACT_LIMITS.phoneDigitsMax} chiffres.`;
  }
  return undefined;
}

export function validateMessage(value: string): string | undefined {
  const length = value.trim().length;
  if (length < CONTACT_LIMITS.messageMin) return `Votre message est un peu court : ${CONTACT_LIMITS.messageMin} caractères au minimum.`;
  if (length > CONTACT_LIMITS.messageMax) return `Votre message est trop long : ${CONTACT_LIMITS.messageMax} caractères au maximum.`;
  return undefined;
}

export function validateConsent(value: boolean): string | undefined {
  return value === true ? undefined : "Cochez la case pour envoyer votre message.";
}

export function validateContact(fields: ContactFields): ContactErrors {
  const errors: ContactErrors = {};
  const first = validateName(fields.firstName, "Prénom");
  if (first) errors.firstName = first;
  const last = validateName(fields.lastName, "Nom");
  if (last) errors.lastName = last;
  const contact = validateContactValue(fields.contact);
  if (contact) errors.contact = contact;
  if (!isContactSubject(fields.subject)) errors.subject = "Choisissez l’objet de votre message.";
  const message = validateMessage(fields.message);
  if (message) errors.message = message;
  const consent = validateConsent(fields.consent);
  if (consent) errors.consent = consent;
  return errors;
}

/** Corps JSON attendu par POST /api/v1/identity/contact/. `website` est le champ leurre : il reste vide pour un humain. */
export function contactPayload(fields: ContactFields, decoy = "") {
  return {
    first_name: collapseSpaces(fields.firstName),
    last_name: collapseSpaces(fields.lastName),
    contact: fields.contact.trim(),
    subject: fields.subject,
    message: fields.message.trim(),
    consent: fields.consent === true,
    website: decoy,
  };
}

const API_TO_FIELD: Record<string, ContactField> = {
  first_name: "firstName",
  last_name: "lastName",
  contact: "contact",
  subject: "subject",
  message: "message",
  consent: "consent",
};

/** Convertit les erreurs champ par champ renvoyées par l'API vers les noms du formulaire. */
export function fieldErrorsFromApi(errors: unknown): ContactErrors {
  const result: ContactErrors = {};
  if (!errors || typeof errors !== "object") return result;
  for (const [key, value] of Object.entries(errors as Record<string, unknown>)) {
    const field = API_TO_FIELD[key];
    if (field && typeof value === "string") result[field] = value;
  }
  return result;
}

/** Objet présélectionné par un lien (?objet=etablissement). Une valeur inconnue est ignorée. */
export function subjectFromQuery(value: string | null | undefined): ContactSubject | "" {
  return isContactSubject(value) ? value : "";
}
