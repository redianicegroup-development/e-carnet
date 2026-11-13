/* Récapitulatif périodique des accès au carnet (PAT-19). Le serveur (commande send_access_summaries) dépose dans les notifications du patient un résumé
   non médical : combien de lectures de son carnet ont eu lieu, par type de structure. Jamais le nom d'un professionnel, jamais un contenu médical. */

export type SummaryFrequency = "disabled" | "weekly" | "monthly";
export type AccessSummaryPreference = { frequency: SummaryFrequency; last_sent_at: string | null };

export const ACCESS_SUMMARY_PATH = "/api/v1/patient/care/access-summary-preference/";

export const SUMMARY_CHOICES: ReadonlyArray<{ value: SummaryFrequency; label: string; hint: string }> = [
  { value: "disabled", label: "Désactivé", hint: "Aucun récapitulatif. Vous retrouvez toujours l’historique des accès dans l’application." },
  { value: "weekly", label: "Chaque semaine", hint: "Un récapitulatif des 7 derniers jours." },
  { value: "monthly", label: "Chaque mois", hint: "Un récapitulatif des 30 derniers jours." },
];

export function isSummaryFrequency(value: unknown): value is SummaryFrequency {
  return value === "disabled" || value === "weekly" || value === "monthly";
}

export function summaryLabel(frequency: SummaryFrequency): string {
  return SUMMARY_CHOICES.find((choice) => choice.value === frequency)?.label ?? "Désactivé";
}

/** Lit la réponse du serveur avec prudence : une valeur inattendue ne doit jamais faire croire que le récapitulatif est activé. */
export function parseAccessSummaryPreference(payload: unknown): AccessSummaryPreference | null {
  if (!payload || typeof payload !== "object") return null;
  const { frequency, last_sent_at: lastSent } = payload as Record<string, unknown>;
  if (!isSummaryFrequency(frequency)) return null;
  const valid = typeof lastSent === "string" && !Number.isNaN(Date.parse(lastSent));
  return { frequency, last_sent_at: valid ? lastSent : null };
}

const SENT_FORMAT = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" });

export function describeLastSent(value: string | null | undefined): string {
  if (!value) return "Aucun récapitulatif envoyé pour le moment.";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Aucun récapitulatif envoyé pour le moment." : `Dernier envoi : ${SENT_FORMAT.format(date)}.`;
}
