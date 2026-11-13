/* PAT-09 — Export du carnet par période et par rubrique. Logique pure (aucun React), testée dans tests/classe-a-2026-11-12.test.mjs.
   Les mêmes paramètres (from, to, sections) servent au PDF et à Excel : le serveur filtre les deux formats par la même fonction. */

export const EXPORT_PATH = "/api/v1/patient/care/export/";

export type ExportFormat = "pdf" | "xlsx";
export type ExportSectionKey = "allergies" | "vaccins" | "mesures" | "consultations" | "prescriptions" | "examens" | "documents";

/** Mêmes clés, même ordre que `SECTION_KEYS` côté serveur (apps/api/apps/care/export_filters.py). */
export const EXPORT_SECTIONS: ReadonlyArray<{ key: ExportSectionKey; label: string; hint: string }> = [
  { key: "allergies", label: "Allergies et déclarations", hint: "Allergies, antécédents et informations que vous avez déclarées." },
  { key: "vaccins", label: "Vaccinations", hint: "Vaccins et doses enregistrés." },
  { key: "mesures", label: "Mesures", hint: "Tension, poids, glycémie et autres mesures." },
  { key: "consultations", label: "Consultations", hint: "Consultations validées par un professionnel." },
  { key: "prescriptions", label: "Ordonnances", hint: "Médicaments prescrits lors des consultations." },
  { key: "examens", label: "Examens", hint: "Examens demandés et résultats reçus." },
  { key: "documents", label: "Documents", hint: "Liste seulement : les fichiers ne sont pas copiés." },
];

export const ALL_SECTION_KEYS: ReadonlyArray<ExportSectionKey> = EXPORT_SECTIONS.map((section) => section.key);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

function validDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const year = Number(value.slice(0, 4));
  if (year < MIN_YEAR || year > MAX_YEAR) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Message à afficher si la période est inutilisable, sinon null. Les deux dates sont facultatives (vide = tout l'historique). */
export function periodProblem(from: string, to: string): string | null {
  if (from && !validDate(from)) return "La date de début n’est pas valide (entre 1900 et 2100).";
  if (to && !validDate(to)) return "La date de fin n’est pas valide (entre 1900 et 2100).";
  if (from && to && from > to) return "La date de fin doit suivre la date de début.";
  return null;
}

/** Garde les seules clés connues, dans l'ordre du serveur, sans doublon. */
export function normalizeSections(selected: ReadonlyArray<string>): ExportSectionKey[] {
  return ALL_SECTION_KEYS.filter((key) => selected.includes(key));
}

export type ExportRequest = { format: ExportFormat; from: string; to: string; sections: ReadonlyArray<string> };

/** Adresse du téléchargement, ou null si la demande est inutilisable (aucune rubrique, période invalide).
    Toutes les rubriques cochées = on n'envoie pas `sections` : c'est l'export complet (le classeur y ajoute rappels, prises et rendez-vous). */
export function buildExportUrl(request: ExportRequest): string | null {
  const sections = normalizeSections(request.sections);
  if (sections.length === 0 || periodProblem(request.from, request.to)) return null;
  const params = new URLSearchParams({ format: request.format });
  if (request.from) params.set("from", request.from);
  if (request.to) params.set("to", request.to);
  if (sections.length < ALL_SECTION_KEYS.length) params.set("sections", sections.join(","));
  return `${EXPORT_PATH}?${params.toString()}`;
}

/** « Tout le carnet », « Du 01/03/2026 au 30/06/2026 », « Depuis le … », « Jusqu'au … » — lue avant le téléchargement. */
export function describeExportPeriod(from: string, to: string): string {
  const fr = (value: string) => value.split("-").reverse().join("/");
  if (from && to) return `Du ${fr(from)} au ${fr(to)}`;
  if (from) return `Depuis le ${fr(from)}`;
  if (to) return `Jusqu’au ${fr(to)}`;
  return "Tout l’historique";
}

export function describeExportSections(selected: ReadonlyArray<string>): string {
  const keys = normalizeSections(selected);
  if (keys.length === ALL_SECTION_KEYS.length) return "Toutes les rubriques";
  if (keys.length === 0) return "Aucune rubrique";
  return keys.map((key) => EXPORT_SECTIONS.find((section) => section.key === key)?.label ?? key).join(", ");
}
