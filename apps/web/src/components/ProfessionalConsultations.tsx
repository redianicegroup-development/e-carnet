"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError } from "../infrastructure/api/client";
import { useConfirm } from "./modal/ConfirmProvider";
import { ConsultationSeal } from "./ConsultationSeal";
import { CollapsibleSection } from "./ui/CollapsibleSection";
import { Encounter, listAuthorizedEncounters, listProfessionalConsultations, listProfessionalGrants, ProfessionalGrant, Consultation, validateProfessionalConsultation, type ConsultationInput } from "../application/professional-access-grants";
import { EXAM_KIND_LABELS, type ExamKind } from "../lib/care-records";
import { emptyVitalsForm, parseVitalsForm, vitalsToForm, VITAL_FIELDS, type VitalsForm } from "../lib/vitals";

type LineDraft = { drug_name: string; dosage: string; posology: string; duration: string; instructions: string };
type ExamDraft = { kind: ExamKind; label: string };
const EMPTY_LINE: LineDraft = { drug_name: "", dosage: "", posology: "", duration: "", instructions: "" };
const MAX_ORDER_LINES = 15;

/** Lignes d'ordonnance et examens demandés → charge utile. Une ligne entièrement vide est ignorée ; une ligne à moitié remplie est refusée. */
function buildOrders(lines: LineDraft[], exams: ExamDraft[]): { ok: true; prescription_lines: NonNullable<ConsultationInput["prescription_lines"]>; requested_exams: NonNullable<ConsultationInput["requested_exams"]> } | { ok: false; message: string } {
  const prescription_lines: NonNullable<ConsultationInput["prescription_lines"]> = [];
  for (const line of lines) {
    const draft = { drug_name: line.drug_name.trim(), dosage: line.dosage.trim(), posology: line.posology.trim(), duration: line.duration.trim(), instructions: line.instructions.trim() };
    if (!Object.values(draft).some(Boolean)) continue;
    if (!draft.drug_name) return { ok: false, message: "Ordonnance : indiquez le nom du médicament pour chaque ligne." };
    if (!draft.posology) return { ok: false, message: `Ordonnance : précisez la posologie de ${draft.drug_name} (ex. 1 cp × 3/jour).` };
    prescription_lines.push(draft);
  }
  const requested_exams = exams.map((exam) => ({ kind: exam.kind, label: exam.label.trim() })).filter((exam) => exam.label);
  return { ok: true, prescription_lines, requested_exams };
}

function VitalsFields({ value, onChange }: { value: VitalsForm; onChange: (next: VitalsForm) => void }) {
  return <fieldset className="visit-block"><legend>Constantes</legend><p className="muted">Relevées en pré-consultation : relisez-les, corrigez ou complétez. Laissez vide ce qui n&apos;a pas été mesuré. Tension et glycémie restent libres, sans conversion.</p><div className="vitals-grid">{VITAL_FIELDS.map((field) => <label className="field" key={field.key}><span>{field.label}{field.unit ? ` (${field.unit})` : ""}</span><input type={field.freeText ? "text" : "number"} inputMode={field.freeText ? "text" : "decimal"} autoComplete="off" maxLength={field.freeText ? 24 : undefined} step={field.freeText ? undefined : field.step} min={field.freeText ? undefined : field.min} max={field.freeText ? undefined : field.max} value={value[field.key]} onChange={(event) => onChange({ ...value, [field.key]: event.target.value })} placeholder={field.placeholder} /></label>)}</div><p className="muted vitals-grid__hint">Tension et glycémie : conserve la valeur et l’unité écrites sur le carnet, sans les convertir.</p></fieldset>;
}

function PrescriptionEditor({ lines, onChange }: { lines: LineDraft[]; onChange: (next: LineDraft[]) => void }) {
  const update = (index: number, patch: Partial<LineDraft>) => onChange(lines.map((line, position) => (position === index ? { ...line, ...patch } : line)));
  return <fieldset className="visit-block"><legend>Ordonnance</legend>{lines.length === 0 && <p className="muted">Aucun médicament prescrit.</p>}{lines.map((line, index) => <div className="order-line" key={index}><div className="order-line__fields"><label className="field"><span>Médicament</span><input maxLength={160} value={line.drug_name} onChange={(event) => update(index, { drug_name: event.target.value })} placeholder="Ex. Paracétamol" /></label><label className="field"><span>Dosage</span><input maxLength={80} value={line.dosage} onChange={(event) => update(index, { dosage: event.target.value })} placeholder="Ex. 1 g" /></label><label className="field"><span>Posologie</span><input maxLength={160} value={line.posology} onChange={(event) => update(index, { posology: event.target.value })} placeholder="Ex. 1 cp × 3/jour" /></label><label className="field"><span>Durée</span><input maxLength={80} value={line.duration} onChange={(event) => update(index, { duration: event.target.value })} placeholder="Ex. 5 jours" /></label><label className="field order-line__wide"><span>Instructions (facultatif)</span><input maxLength={240} value={line.instructions} onChange={(event) => update(index, { instructions: event.target.value })} placeholder="Ex. après les repas" /></label></div><button type="button" className="button order-line__remove" onClick={() => onChange(lines.filter((_, position) => position !== index))} aria-label={`Retirer la ligne ${index + 1}`}>Retirer</button></div>)}<button type="button" className="button" disabled={lines.length >= MAX_ORDER_LINES} onClick={() => onChange([...lines, { ...EMPTY_LINE }])}>Ajouter un médicament</button></fieldset>;
}

function ExamEditor({ exams, onChange }: { exams: ExamDraft[]; onChange: (next: ExamDraft[]) => void }) {
  const update = (index: number, patch: Partial<ExamDraft>) => onChange(exams.map((exam, position) => (position === index ? { ...exam, ...patch } : exam)));
  return <fieldset className="visit-block"><legend>Examens demandés</legend>{exams.length === 0 && <p className="muted">Aucun examen demandé.</p>}{exams.map((exam, index) => <div className="order-line order-line--exam" key={index}><div className="order-line__fields"><label className="field"><span>Type</span><select value={exam.kind} onChange={(event) => update(index, { kind: event.target.value as ExamKind })}>{(Object.keys(EXAM_KIND_LABELS) as ExamKind[]).map((kind) => <option key={kind} value={kind}>{EXAM_KIND_LABELS[kind]}</option>)}</select></label><label className="field order-line__wide"><span>Examen</span><input maxLength={160} value={exam.label} onChange={(event) => update(index, { label: event.target.value })} placeholder="Ex. NFS, radiographie du thorax" /></label></div><button type="button" className="button order-line__remove" onClick={() => onChange(exams.filter((_, position) => position !== index))} aria-label={`Retirer l&apos;examen ${index + 1}`}>Retirer</button></div>)}<button type="button" className="button" disabled={exams.length >= MAX_ORDER_LINES} onClick={() => onChange([...exams, { kind: "analysis", label: "" }])}>Ajouter un examen</button><p className="muted">Un examen reste « demandé » tant que son résultat n&apos;est pas arrivé dans le carnet.</p></fieldset>;
}

const MOCK_CONSULTATIONS: Consultation[] = [];

export function ProfessionalConsultations() {
  const confirm = useConfirm();
  const [grants, setGrants] = useState<ProfessionalGrant[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>(MOCK_CONSULTATIONS);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [grantId, setGrantId] = useState("");
  const [encounterId, setEncounterId] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [carePlan, setCarePlan] = useState("");
  const [reason, setReason] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [clinicalExam, setClinicalExam] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [vitalsForm, setVitalsForm] = useState<VitalsForm>(emptyVitalsForm());
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [exams, setExams] = useState<ExamDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEncounters, setLoadingEncounters] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("Chargement des autorisations actives…");
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const editing = target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "");
      if (event.key === "/" && !editing && window.matchMedia("(min-width: 920px)").matches) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape" && document.activeElement === searchRef.current) {
        setSearch("");
        searchRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([listProfessionalGrants(), listProfessionalConsultations()]).then(([allGrants, allConsultations]) => {
      if (!active) return;
      setGrants(allGrants.filter((grant) => grant.status === "active" && grant.scope.includes("preconsultation")));
      setConsultations(allConsultations);
      setMessage("Données chargées.");
    }).catch((error: unknown) => {
      if (active) setMessage(error instanceof ApiError ? error.message : "Impossible de charger les consultations.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function chooseGrant(value: string) {
    setGrantId(value);
    setEncounterId("");
    setEncounters([]);
    if (!value) return;
    setLoadingEncounters(true);
    try {
      const drafts = await listAuthorizedEncounters(value);
      setEncounters(drafts);
      setEncounterId(drafts[0]?.id ?? "");
      // Le brouillon du patient (ou de l'infirmier) préremplit la consultation : on relit, corrige et complète au lieu de ressaisir.
      setReason(drafts[0]?.reason ?? "");
      setSymptoms(drafts[0]?.observations ?? "");
      setVitalsForm(vitalsToForm(drafts[0]?.vitals));
      setMessage(drafts.length ? "Pré-consultation du patient chargée." : "Le patient n’a pas encore préparé de pré-consultation.");
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "Pré-consultations indisponibles.");
    } finally {
      setLoadingEncounters(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!grantId || !encounterId) return;
    if (!conclusion.trim() && !diagnosis.trim()) { setMessage("Renseignez au moins le diagnostic ou la conclusion avant de signer."); return; }
    const parsedVitals = parseVitalsForm(vitalsForm);
    if (!parsedVitals.ok) { setMessage(parsedVitals.message); return; }
    const orders = buildOrders(lines, exams);
    if (!orders.ok) { setMessage(orders.message); return; }
    const accepted = await confirm({
      title: "Terminer et signer la consultation ?",
      message: "La signature clôture la pré-consultation du patient et la rattache à votre établissement. L’ordonnance et les examens demandés sont signés avec la consultation.",
      note: "Cette action ne peut pas être annulée : le patient verra la consultation dans son carnet.",
      confirmLabel: "Signer et clôturer",
      cancelLabel: "Continuer à rédiger",
    });
    if (!accepted) return;
    setSubmitting(true);
    try {
      const consultation = await validateProfessionalConsultation({
        access_grant_id: grantId,
        source_encounter_id: encounterId,
        reason: reason.trim(),
        symptoms: symptoms.trim(),
        clinical_exam: clinicalExam.trim(),
        diagnosis: diagnosis.trim(),
        vitals: parsedVitals.vitals,
        prescription_lines: orders.prescription_lines,
        requested_exams: orders.requested_exams,
        conclusion,
        care_plan: carePlan,
        attestation_svg: "<svg></svg>",
      });
      setConsultations((current) => [consultation, ...current]);
      setConclusion("");
      setCarePlan("");
      setReason("");
      setSymptoms("");
      setClinicalExam("");
      setDiagnosis("");
      setVitalsForm(emptyVitalsForm());
      setLines([]);
      setExams([]);
      setEncounters([]);
      setEncounterId("");
      setGrantId("");
      setMessage("Consultation signée. La pré-consultation est clôturée et le carnet du patient est à jour.");
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "Validation impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  const filteredConsultations = consultations.filter((item) => `${item.facility_label} ${item.reason} ${item.professional_name}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

  return <div className="stack-lg"><section className="hero-page"><span className="eyebrow">Provenance conservée</span><h1>Compléter sans ressaisir.</h1><p className="muted">La dernière pré-consultation préparée par le patient (ou par l’infirmier avec son téléphone) s’affiche dès que son autorisation est active. En signant, vous la clôturez : l’auteur et l’établissement sont imposés par le serveur.</p><p className="notice" role="status" aria-live="polite">{message}</p></section><section className="patient-grid"><form className="card" onSubmit={submit}><span className="eyebrow">Nouvelle validation</span><h2>Terminer la consultation</h2>{loading ? <p className="empty">Chargement des autorisations…</p> : grants.length === 0 ? <p className="empty">Aucune autorisation active permettant de reprendre une pré-consultation.</p> : <><label className="field"><span>Autorisation active</span><select required value={grantId} onChange={(event) => chooseGrant(event.target.value)}><option value="">Choisir une autorisation</option>{grants.map((grant) => <option key={grant.id} value={grant.id}>{grant.facility_label} · accès {grant.reference}</option>)}</select></label><div className="preconsult-read" aria-live="polite"><span className="preconsult-read__label">Pré-consultation du patient</span>{loadingEncounters ? <p className="muted">Chargement…</p> : !grantId ? <p className="muted">Choisissez une autorisation pour lire la dernière pré-consultation.</p> : encounters.length === 0 ? <p className="empty">Aucune pré-consultation en préparation pour ce patient.</p> : encounters.map((encounter) => <article className="record preconsult-read__item" key={encounter.id}><div><strong>{encounter.reason || "Sans motif"}</strong>{encounter.observations && <p>{encounter.observations}</p>}{encounter.recorded_with_help && <p className="muted">Rempli avec l’aide de : {encounter.recorded_with_help}</p>}</div><span className="badge pending">Brouillon</span></article>)}</div><VitalsFields value={vitalsForm} onChange={setVitalsForm} /><fieldset className="visit-block"><legend>Motif et symptômes</legend><label className="field"><span>Motif</span><input maxLength={240} value={reason} onChange={(event) => setReason(event.target.value)} /></label><label className="field"><span>Symptômes</span><textarea maxLength={4000} rows={3} value={symptoms} onChange={(event) => setSymptoms(event.target.value)} /></label></fieldset><fieldset className="visit-block"><legend>Examen et diagnostic</legend><label className="field"><span>Examen clinique</span><textarea maxLength={4000} rows={3} value={clinicalExam} onChange={(event) => setClinicalExam(event.target.value)} /></label><label className="field"><span>Diagnostic</span><textarea maxLength={2000} rows={2} value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} /></label></fieldset><fieldset className="visit-block"><legend>Conduite à tenir</legend><label className="field"><span>Conclusion</span><textarea maxLength={4000} rows={3} value={conclusion} onChange={(event) => setConclusion(event.target.value)} /></label><label className="field"><span>Conduite à tenir</span><textarea maxLength={4000} rows={3} value={carePlan} onChange={(event) => setCarePlan(event.target.value)} /></label></fieldset><PrescriptionEditor lines={lines} onChange={setLines} /><ExamEditor exams={exams} onChange={setExams} /><p className="muted">Une attestation SVG est enregistrée avec la validation. Elle ne constitue pas une signature électronique qualifiée.</p><ConsultationSeal /><button className="button primary" type="submit" disabled={submitting || !encounterId}>{submitting ? "Signature…" : "Terminer et signer"}</button></>}</form><div className="section-grid"><CollapsibleSection title="Mes consultations" icon="stethoscope" hint="Historique signé"><div className="professional-history"><div className="professional-history__heading"><label className="professional-quick-search"><span className="sr-only">Rechercher établissement ou motif</span><input ref={searchRef} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Établissement, motif…" /><kbd aria-hidden="true">/</kbd></label></div>{loading ? <p className="empty">Chargement…</p> : filteredConsultations.length === 0 ? <p className="empty">{consultations.length ? "Aucun résultat pour cette recherche." : "Aucune consultation validée."}</p> : <div className="professional-compact-list" aria-live="polite">{filteredConsultations.map((item) => <article className="professional-compact-record" key={item.id}><div><strong>{item.reason}</strong><p>{item.facility_label} · {item.provenance.label}</p></div><span className="badge verified">Validée</span></article>)}</div>}</div></CollapsibleSection></div></section></div>;
}
