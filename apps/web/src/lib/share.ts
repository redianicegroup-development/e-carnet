/* Partage d'un code généré (mot de passe temporaire, code médecin, mot de proche de confiance). Fichier pur, sans React, pour être testé.

   Le partage passe par la feuille de partage du téléphone (WhatsApp, SMS, e-mail…) quand elle existe ; sinon le message est copié.
   Le message contient toujours le lien de l'application, et pour un accès l'e-mail et le code : il est utilisable tel quel par son destinataire. */

export type ShareContent = { title: string; text: string };
export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

/** Ce dont le partage a besoin ; injectable pour les tests (le navigateur fournit les vraies valeurs). */
export type ShareEnvironment = {
  share?: (data: ShareContent) => Promise<void>;
  writeText?: (text: string) => Promise<void>;
};

export async function shareContent(content: ShareContent, env: ShareEnvironment = browserEnvironment()): Promise<ShareOutcome> {
  if (env.share) {
    try {
      await env.share(content);
      return "shared";
    } catch (error) {
      // La personne a fermé la feuille de partage : ce n'est pas une erreur, et on ne copie rien à sa place.
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      if (error instanceof Error && error.name === "AbortError") return "cancelled";
      // Autre échec (partage non autorisé dans ce contexte…) : on retombe sur la copie.
    }
  }
  if (env.writeText) {
    try {
      await env.writeText(content.text);
      return "copied";
    } catch {
      return "failed";
    }
  }
  return "failed";
}

function browserEnvironment(): ShareEnvironment {
  if (typeof navigator === "undefined") return {};
  const env: ShareEnvironment = {};
  if (typeof navigator.share === "function") env.share = (data) => navigator.share(data);
  if (navigator.clipboard?.writeText) env.writeText = (text) => navigator.clipboard.writeText(text);
  return env;
}

export const SHARE_FEEDBACK: Record<ShareOutcome, string> = {
  shared: "Partagé.",
  copied: "Message copié : collez-le dans votre messagerie.",
  cancelled: "",
  failed: "Partage impossible : copiez le code à la main.",
};

const when = (value: string | null | undefined) => (value ? new Date(value).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) : "");

/** Adresse de connexion à partir de l'origine de l'application (« https://… » → « https://…/connexion »). */
export function loginUrlFor(origin: string): string {
  return `${origin.replace(/\/+$/, "")}/connexion`;
}

/* ---------- messages ---------- */

export type AccessKind = "laboratory" | "establishment";

/** Accès ouvert avec un mot de passe temporaire : e-mail, mot de passe, lien de connexion. */
export function accessMessage(input: { kind: AccessKind; structure: string; email: string; password: string; loginUrl: string; expiresAt?: string | null }): string {
  const role = input.kind === "laboratory" ? `administrateur du laboratoire « ${input.structure} »` : `administrateur de « ${input.structure} »`;
  const expiry = input.expiresAt ? ` (mot de passe temporaire valable jusqu’au ${when(input.expiresAt)})` : "";
  return [
    `Mon E‑Carnet — votre accès ${role} est ouvert.`,
    `Connexion : ${input.loginUrl}`,
    `E‑mail : ${input.email}`,
    `Mot de passe temporaire : ${input.password}`,
    "",
    `À votre première connexion, saisissez exactement cet e‑mail et ce mot de passe temporaire, puis choisissez votre nouveau mot de passe${expiry}.`,
  ].join("\n");
}

/** Code médecin (48 h, usage unique) remis par un établissement. */
export function joinCodeMessage(input: { code: string; expiresAt?: string | null; accessUrl: string }): string {
  return [
    "Mon E‑Carnet — code de rattachement médecin",
    `Code : ${input.code}`,
    input.expiresAt ? `Valable jusqu’au ${when(input.expiresAt)}, une seule fois.` : "Valable 48 h, une seule fois.",
    `Saisissez-le dans « Mon rattachement » : ${input.accessUrl}`,
  ].join("\n");
}

/** Mot de rattachement d'un proche de confiance (72 h). */
export function delegationMessage(input: { code: string; trustedUrl: string }): string {
  return [
    "Mon E‑Carnet — mot de rattachement « proche de confiance »",
    `Mot : ${input.code}`,
    "Valable 72 heures, une seule fois.",
    `Saisissez-le dans « J’ai reçu un mot » : ${input.trustedUrl}`,
  ].join("\n");
}

/** Mot de passe temporaire émis par l'équipe pour récupérer un compte. */
export function recoveryPasswordMessage(input: { email: string; password: string; loginUrl: string; expiresAt?: string | null }): string {
  return [
    "Mon E‑Carnet — mot de passe temporaire",
    `Connexion : ${input.loginUrl}`,
    `E‑mail : ${input.email}`,
    `Mot de passe temporaire : ${input.password}`,
    "",
    `Saisissez exactement cet e‑mail et ce mot de passe, puis choisissez votre nouveau mot de passe${input.expiresAt ? ` (valable jusqu’au ${when(input.expiresAt)})` : ""}.`,
  ].join("\n");
}
