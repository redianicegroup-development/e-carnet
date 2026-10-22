/* Messages clairs de « Récupérer mon compte » : essais restants, blocage, réponse acceptée.

   Le serveur renvoie `code`, `attempts_remaining`, `locked_until`, `retry_after` avec la même forme et les mêmes valeurs pour une adresse
   qui a un compte et pour une adresse qui n'en a pas (voir api identity/recovery.py, attempt_status) : ces messages ne révèlent rien.
   Fichier pur (sans React) pour pouvoir être testé. */
import type { ModalMood } from "../modal/ModalIllustration";

export type RecoveryFailure = { code?: string; attempts_remaining?: number; locked_until?: string | null; retry_after?: number };
export type RecoveryNotice = {
  tone: "success" | "danger";
  mood: ModalMood;
  title: string;
  message: string;
  note?: string;
  primaryLabel: string;
  secondaryLabel?: string;
  /** Ce que fait le bouton principal. */
  primary: "retry" | "help" | "password" | "close";
  /** Ce que fait le bouton secondaire. */
  secondary?: "retry" | "help" | "password" | "close";
};

/** « 14 min », « 1 h 05 », « 24 h » : une durée lisible à partir de secondes. */
export function formatWait(seconds: number): string {
  const total = Math.max(1, Math.round(seconds));
  if (total < 90) return `${total} s`;
  const minutes = Math.ceil(total / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${String(rest).padStart(2, "0")}` : `${hours} h`;
}

function clockTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

/** Rappel sous le formulaire pendant un blocage. */
export function lockedInline(failure: RecoveryFailure): string {
  const until = clockTime(failure.locked_until);
  return until ? `Récupération bloquée jusqu’à ${until}.` : "Récupération bloquée temporairement.";
}

export function lockedNotice(failure: RecoveryFailure): RecoveryNotice {
  const until = clockTime(failure.locked_until);
  const wait = failure.retry_after ? formatWait(failure.retry_after) : "";
  const when = [until && `jusqu’à ${until}`, wait && `dans ${wait}`].filter(Boolean).join(", ");
  return {
    tone: "danger", mood: "oops",
    title: "Récupération bloquée pour le moment",
    message: `Trop de réponses incorrectes. Pour protéger le carnet, la récupération est fermée${when ? ` (${when})` : " temporairement"}.`,
    note: "Cette limite empêche quelqu’un de deviner votre réponse. Si vous ne vous en souvenez plus, écrivez à l’équipe : elle vérifie votre identité avant de rouvrir l’accès.",
    primaryLabel: "Écrire à l’équipe", primary: "help",
    secondaryLabel: "Fermer", secondary: "close",
  };
}

export function wrongAnswerNotice(failure: RecoveryFailure): RecoveryNotice {
  const left = failure.attempts_remaining ?? 0;
  const last = left === 1;
  return {
    tone: "danger", mood: "question",
    title: "Réponse incorrecte",
    message: left > 0
      ? (last ? "Ce n’est pas la bonne réponse. Il vous reste un seul essai avant un blocage temporaire de la récupération."
        : `Ce n’est pas la bonne réponse. Il vous reste ${left} essais avant un blocage temporaire de la récupération.`)
      : "Ce n’est pas la bonne réponse.",
    note: "Les majuscules et les espaces autour ne comptent pas, mais les accents oui. Après plusieurs erreurs, la récupération se ferme 15 minutes, puis de plus en plus longtemps.",
    primaryLabel: "Réessayer", primary: "retry",
    secondaryLabel: "Je ne me souviens plus", secondary: "help",
  };
}

export function throttledNotice(): RecoveryNotice {
  return {
    tone: "danger", mood: "oops",
    title: "Trop de tentatives",
    message: "Vous avez fait beaucoup de demandes en peu de temps. Patientez un moment avant de réessayer.",
    note: "Si vous êtes bloqué, écrivez à l’équipe : elle vous répondra pour vérifier votre identité.",
    primaryLabel: "Écrire à l’équipe", primary: "help",
    secondaryLabel: "Fermer", secondary: "close",
  };
}

export function acceptedNotice(): RecoveryNotice {
  return {
    tone: "success", mood: "success",
    title: "Réponse acceptée",
    message: "C’est la bonne réponse. Vous pouvez maintenant choisir un nouveau mot de passe.",
    note: "Pour votre sécurité, vos autres appareils seront déconnectés et un e-mail de confirmation vous sera envoyé.",
    primaryLabel: "Choisir mon mot de passe", primary: "password",
  };
}

/** Transforme une erreur d'API en message à afficher, ou null si ce n'est pas un échec de réponse (erreur réseau, validation…). */
export function noticeForFailure(status: number | undefined, details: unknown): RecoveryNotice | null {
  if (status === 429) return throttledNotice();
  if (status !== 400 || !details || typeof details !== "object") return null;
  const failure = details as RecoveryFailure;
  if (failure.code === "recovery_locked") return lockedNotice(failure);
  if (failure.code === "wrong_answer") return wrongAnswerNotice(failure);
  return null;
}
