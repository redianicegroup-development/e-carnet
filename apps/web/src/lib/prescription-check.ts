import type { LineDraft } from "../components/consultation/OrderPickers";

export type PrescriptionLinePayload = { drug_name: string; dosage: string; posology: string; duration: string; instructions: string };

/** Lignes d'ordonnance → charge utile. Une ligne entièrement vide est ignorée ; une ligne à moitié remplie est refusée (même règle que la consultation). */
export function checkPrescriptionLines(lines: LineDraft[]): { ok: true; lines: PrescriptionLinePayload[] } | { ok: false; message: string } {
  const result: PrescriptionLinePayload[] = [];
  for (const line of lines) {
    const draft = { drug_name: line.drug_name.trim(), dosage: line.dosage.trim(), posology: line.posology.trim(), duration: line.duration.trim(), instructions: line.instructions.trim() };
    if (!Object.values(draft).some(Boolean)) continue;
    if (!draft.drug_name) return { ok: false, message: "Ordonnance : choisissez le médicament pour chaque ligne." };
    if (!draft.posology) return { ok: false, message: `Ordonnance : choisissez la posologie de ${draft.drug_name}.` };
    result.push(draft);
  }
  return { ok: true, lines: result };
}
