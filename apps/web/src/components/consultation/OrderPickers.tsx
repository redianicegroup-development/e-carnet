"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { compressImage, PROOF_MAX_BYTES } from "../../lib/image-compress";
import { DOSAGES, DURATIONS, EXAM_CHOICES, INSTRUCTIONS, MEDICATION_GROUPS, POSOLOGIES } from "../../lib/consultation-options";
import { EXAM_KIND_LABELS, type ExamKind } from "../../lib/care-records";
import { PickOrOther } from "./ConsultationParts";

export type LineDraft = { drug_name: string; dosage: string; posology: string; duration: string; instructions: string };
export type ExamDraft = { kind: ExamKind; label: string; photo: File | null };
export const EMPTY_LINE: LineDraft = { drug_name: "", dosage: "", posology: "", duration: "", instructions: "" };
export const EMPTY_EXAM: ExamDraft = { kind: "analysis", label: "", photo: null };
export const MAX_ORDER_LINES = 15;

/** Ordonnance : chaque champ est une liste (médicament, dosage, posologie, durée, instructions), avec « Autre (préciser) ». */
export function PrescriptionPicker({ lines, onChange }: { lines: LineDraft[]; onChange: (next: LineDraft[]) => void }) {
  const update = (index: number, patch: Partial<LineDraft>) => onChange(lines.map((line, position) => (position === index ? { ...line, ...patch } : line)));
  return (
    <div className="stack">
      {lines.length === 0 && <p className="muted">Aucun médicament prescrit.</p>}
      {lines.map((line, index) => (
        <div className="order-line" key={index}>
          <div className="order-line__fields">
            <PickOrOther wide label="Médicament" groups={MEDICATION_GROUPS} value={line.drug_name} onChange={(drug_name) => update(index, { drug_name })} />
            <PickOrOther label="Dosage" options={DOSAGES} maxLength={80} value={line.dosage} onChange={(dosage) => update(index, { dosage })} />
            <PickOrOther label="Posologie" options={POSOLOGIES} value={line.posology} onChange={(posology) => update(index, { posology })} />
            <PickOrOther label="Durée" options={DURATIONS} maxLength={80} value={line.duration} onChange={(duration) => update(index, { duration })} />
            <PickOrOther wide label="Instructions (facultatif)" options={INSTRUCTIONS} maxLength={240} emptyLabel="Aucune" value={line.instructions} onChange={(instructions) => update(index, { instructions })} />
          </div>
          <button type="button" className="button order-line__remove" onClick={() => onChange(lines.filter((_, position) => position !== index))}>Retirer</button>
        </div>
      ))}
      <button type="button" className="button" disabled={lines.length >= MAX_ORDER_LINES} onClick={() => onChange([...lines, { ...EMPTY_LINE }])}>Ajouter un médicament</button>
    </div>
  );
}

function ExamPhoto({ photo, onChange }: { photo: File | null; onChange: (next: File | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : ""), [photo]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) { setError("Choisissez une photo (JPG, PNG ou WebP)."); return; }
    setBusy(true);
    const ready = await compressImage(file);
    setBusy(false);
    if (ready.size > PROOF_MAX_BYTES) { setError("Cette photo est trop lourde (10 Mo au maximum)."); return; }
    onChange(ready);
  }

  // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:) de la photo choisie, pas une image du site
  const thumb = photo ? <img src={preview} alt="Photo de la demande d’examen" /> : null;
  return (
    <div className="exam-photo">
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" capture="environment" hidden onChange={(event) => { void pick(event.target.files?.[0]); event.target.value = ""; }} />
      {photo
        ? <div className="exam-photo__preview">{thumb}<div><strong>Photo jointe</strong><p className="muted">Elle reste dans le carnet du patient comme preuve de la demande.</p><button type="button" className="button small" onClick={() => onChange(null)}>Retirer la photo</button></div></div>
        : <button type="button" className="button small" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Préparation de la photo…" : "Ajouter une photo de la demande"}</button>}
      {error && <p className="status" role="alert">{error}</p>}
    </div>
  );
}

/** Examens demandés : type puis examen en liste ; ou, sans rien saisir, la photo de la demande (preuve). */
export function ExamPicker({ exams, onChange }: { exams: ExamDraft[]; onChange: (next: ExamDraft[]) => void }) {
  const update = (index: number, patch: Partial<ExamDraft>) => onChange(exams.map((exam, position) => (position === index ? { ...exam, ...patch } : exam)));
  return (
    <div className="stack">
      {exams.length === 0 && <p className="muted">Aucun examen demandé.</p>}
      {exams.map((exam, index) => (
        <div className="order-line order-line--exam" key={index}>
          <div className="order-line__fields">
            <label className="field"><span>Type</span>
              <select value={exam.kind} onChange={(event) => { const kind = event.target.value as ExamKind; update(index, { kind, label: EXAM_CHOICES[exam.kind].includes(exam.label) ? "" : exam.label }); }}>
                {(Object.keys(EXAM_KIND_LABELS) as ExamKind[]).map((kind) => <option key={kind} value={kind}>{EXAM_KIND_LABELS[kind]}</option>)}
              </select>
            </label>
            <PickOrOther wide label="Examen" options={EXAM_CHOICES[exam.kind]} value={exam.label} onChange={(label) => update(index, { label })} emptyLabel={exam.photo ? "Voir la photo" : "Choisir un examen…"} />
          </div>
          <ExamPhoto photo={exam.photo} onChange={(photo) => update(index, { photo })} />
          <button type="button" className="button order-line__remove" onClick={() => onChange(exams.filter((_, position) => position !== index))}>Retirer</button>
        </div>
      ))}
      <button type="button" className="button" disabled={exams.length >= MAX_ORDER_LINES} onClick={() => onChange([...exams, { ...EMPTY_EXAM }])}>Ajouter un examen</button>
      <p className="muted">Un examen reste « demandé » tant que son résultat n’est pas arrivé dans le carnet.</p>
    </div>
  );
}
