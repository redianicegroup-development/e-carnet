"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "../infrastructure/api/client";
import { useConfirm } from "./modal/ConfirmProvider";
import { ConsultationSeal } from "./ConsultationSeal";
import { ProfessionalMeasurementEntry } from "./ProfessionalMeasurementEntry";
import { ProfessionalTemplateApprovals } from "./ProfessionalTemplateApprovals";
import { CollapsibleSection } from "./ui/CollapsibleSection";
import { PersonAvatar } from "./ui/PersonAvatar";
import { EstablishmentLogo } from "./EstablishmentLogo";
import { useProfessionalProfile } from "./ClinicalGate";
import { ChipPicker, FormSection, VitalsPicker } from "./consultation/ConsultationParts";
import { ExamPicker, PrescriptionPicker, type ExamDraft, type LineDraft } from "./consultation/OrderPickers";
import { Encounter, listAuthorizedEncounters, listProfessionalConsultations, listProfessionalGrants, ProfessionalGrant, Consultation, uploadExamProof, validateProfessionalConsultation, type ConsultationInput } from "../application/professional-access-grants";
import { CARE_PLAN_ITEMS, CLINICAL_FINDINGS, CONCLUSION_ITEMS, DIAGNOSES, buildPicked } from "../lib/consultation-options";
import { buildObservations, OBSERVATIONS_MAX, OTHER_MAX, parseObservations, SYMPTOMS, type SymptomsForm } from "../lib/preconsult";
import { emptyVitalsForm, parseVitalsForm, vitalsToForm, type VitalsForm } from "../lib/vitals";
import "./consultation-flow.css";

/* Consultation du médecin. Même expérience que la pré-consultation du patient : on SÉLECTIONNE (puces, listes), on n'écrit que l'« Autre ».
   Le patient est choisi parmi ses autorisations actives DANS L'ÉTABLISSEMENT ACTIF, qui se règle depuis « Mon rattachement ». */

type PickState = { selected: string[]; other: string };
const EMPTY_PICK: PickState = { selected: [], other: "" };

type OrdersResult = { ok: true; prescription_lines: NonNullable<ConsultationInput["prescription_lines"]>; exams: ExamDraft[] } | { ok: false; message: string };

/** Lignes d'ordonnance et examens → charge utile. Une ligne entièrement vide est ignorée ; une ligne à moitié remplie est refusée. */
function checkOrders(lines: LineDraft[], exams: ExamDraft[]): OrdersResult {
  const prescription_lines: NonNullable<ConsultationInput["prescription_lines"]> = [];
  for (const line of lines) {
    const draft = { drug_name: line.drug_name.trim(), dosage: line.dosage.trim(), posology: line.posology.trim(), duration: line.duration.trim(), instructions: line.instructions.trim() };
    if (!Object.values(draft).some(Boolean)) continue;
    if (!draft.drug_name) return { ok: false, message: "Ordonnance : choisissez le médicament pour chaque ligne." };
    if (!draft.posology) return { ok: false, message: `Ordonnance : choisissez la posologie de ${draft.drug_name}.` };
    prescription_lines.push(draft);
  }
  // Un examen sans libellé ni photo est ignoré ; avec une photo seule, la demande reste valable (la photo est la preuve).
  return { ok: true, prescription_lines, exams: exams.filter((exam) => exam.label.trim() || exam.photo) };
}

const MOCK_CONSULTATIONS: Consultation[] = [];

export function ProfessionalConsultations() {
  const confirm = useConfirm();
  const profile = useProfessionalProfile();
  const [grants, setGrants] = useState<ProfessionalGrant[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>(MOCK_CONSULTATIONS);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [grantId, setGrantId] = useState("");
  const [encounterId, setEncounterId] = useState("");
  const [reason, setReason] = useState("");
  const [symptoms, setSymptoms] = useState<SymptomsForm>({ selected: [], other: "" });
  const [vitalsForm, setVitalsForm] = useState<VitalsForm>(emptyVitalsForm());
  const [clinical, setClinical] = useState<PickState>(EMPTY_PICK);
  const [diagnosis, setDiagnosis] = useState<PickState>(EMPTY_PICK);
  const [carePlan, setCarePlan] = useState<PickState>(EMPTY_PICK);
  const [conclusion, setConclusion] = useState<PickState>(EMPTY_PICK);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [exams, setExams] = useState<ExamDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEncounters, setLoadingEncounters] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("Chargement des autorisations actives…");
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  // Photos déjà envoyées : si la signature échoue après l'envoi, un nouvel essai réutilise la photo au lieu de la renvoyer.
  const uploadedProofs = useRef(new WeakMap<File, string>());

  const activeMembership = profile.status === "ready" ? profile.profile.memberships.find((item) => item.establishment_id === profile.profile.active_establishment && item.status === "active") ?? null : null;

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
      const usable = allGrants.filter((grant) => grant.status === "active" && grant.scope.includes("preconsultation"));
      setGrants(usable);
      setConsultations(allConsultations);
      setMessage(usable.length === 1 ? "Un patient a autorisé son accès." : "Données chargées.");
      // Un seul patient autorisé : inutile de le choisir, sa pré-consultation s'ouvre directement.
      if (usable.length === 1) void chooseGrant(usable[0].id);
    }).catch((error: unknown) => {
      if (active) setMessage(error instanceof ApiError ? error.message : "Impossible de charger les consultations.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function resetForm() {
    setReason(""); setSymptoms({ selected: [], other: "" }); setVitalsForm(emptyVitalsForm());
    setClinical(EMPTY_PICK); setDiagnosis(EMPTY_PICK); setCarePlan(EMPTY_PICK); setConclusion(EMPTY_PICK);
    setLines([]); setExams([]);
  }

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
      setSymptoms(parseObservations(drafts[0]?.observations));
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
    const diagnosisText = buildPicked(diagnosis.selected, DIAGNOSES, diagnosis.other);
    const conclusionText = buildPicked(conclusion.selected, CONCLUSION_ITEMS, conclusion.other);
    if (!conclusionText && !diagnosisText) { setMessage("Choisissez au moins le diagnostic ou la conclusion avant de signer."); return; }
    const parsedVitals = parseVitalsForm(vitalsForm);
    if (!parsedVitals.ok) { setMessage(parsedVitals.message); return; }
    const orders = checkOrders(lines, exams);
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
      const requested_exams: NonNullable<ConsultationInput["requested_exams"]> = [];
      for (const exam of orders.exams) {
        let proof: string | null = null;
        if (exam.photo) {
          proof = uploadedProofs.current.get(exam.photo) ?? null;
          if (!proof) { proof = (await uploadExamProof(grantId, exam.photo)).id; uploadedProofs.current.set(exam.photo, proof); }
        }
        requested_exams.push({ kind: exam.kind, label: exam.label.trim(), ...(proof ? { proof_document_id: proof } : {}) });
      }
      const consultation = await validateProfessionalConsultation({
        access_grant_id: grantId,
        source_encounter_id: encounterId,
        reason: reason.trim(),
        symptoms: buildObservations(symptoms),
        clinical_exam: buildPicked(clinical.selected, CLINICAL_FINDINGS, clinical.other),
        diagnosis: diagnosisText,
        vitals: parsedVitals.vitals,
        prescription_lines: orders.prescription_lines,
        requested_exams,
        conclusion: conclusionText,
        care_plan: buildPicked(carePlan.selected, CARE_PLAN_ITEMS, carePlan.other),
        attestation_svg: "<svg></svg>",
      });
      setConsultations((current) => [consultation, ...current]);
      resetForm();
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
  const selectedGrant = grants.find((grant) => grant.id === grantId) ?? null;
  const symptomsTooLong = buildObservations(symptoms).length > OBSERVATIONS_MAX;

  return <div className="stack-lg"><ProfessionalTemplateApprovals /><section className="hero-page"><span className="eyebrow">Provenance conservée</span><h1>Compléter sans ressaisir.</h1><p className="muted">La dernière pré-consultation préparée par le patient (ou par l’infirmier avec son téléphone) s’affiche dès que son autorisation est active. En signant, vous la clôturez : l’auteur et l’établissement sont imposés par le serveur.</p><p className="notice" role="status" aria-live="polite">{message}</p></section><section className="patient-grid"><form className="card preconsult-form" onSubmit={submit}><span className="eyebrow">Nouvelle validation</span><h2>Terminer la consultation</h2>{loading ? <p className="empty">Chargement des autorisations…</p> : grants.length === 0 ? <p className="empty">Aucune autorisation active permettant de reprendre une pré-consultation.</p> : <>
    <div className="consult-context">
      {activeMembership && <div className="consult-establishment"><EstablishmentLogo logo={activeMembership.establishment_logo} name={activeMembership.establishment_name} size={40} /><div><span className="muted">Établissement actif</span><strong>{activeMembership.establishment_name}</strong></div><Link className="button small" href="/professionnel/acces">Changer</Link></div>}
      {grants.length > 1 && <div className="patient-picker" role="group" aria-label="Patient"><span className="eyebrow">Patient</span>{grants.map((grant) => <button type="button" key={grant.id} className="patient-option" aria-pressed={grant.id === grantId} onClick={() => void chooseGrant(grant.id)}><PersonAvatar src={grant.patient_avatar} name={grant.patient_name || grant.reference} size={40} /><span><strong>{grant.patient_name || `Accès ${grant.reference}`}</strong><small className="muted">Accès {grant.reference}</small></span></button>)}</div>}
      {grants.length === 1 && <div className="patient-picker"><span className="eyebrow">Patient</span><div className="patient-option" aria-current="true"><PersonAvatar src={grants[0].patient_avatar} name={grants[0].patient_name || grants[0].reference} size={40} /><span><strong>{grants[0].patient_name || `Accès ${grants[0].reference}`}</strong><small className="muted">Accès {grants[0].reference}</small></span></div></div>}
    </div>
    {!grantId ? <p className="muted">Choisissez le patient pour lire sa dernière pré-consultation.</p> : <>
    <div className="preconsult-read" aria-live="polite"><span className="preconsult-read__label">Pré-consultation du patient</span>{loadingEncounters ? <p className="muted">Chargement…</p> : !grantId ? <p className="muted">Choisissez une autorisation pour lire la dernière pré-consultation.</p> : encounters.length === 0 ? <p className="empty">Aucune pré-consultation en préparation pour ce patient.</p> : encounters.map((encounter) => <article className="record preconsult-read__item" key={encounter.id}><div><strong>{encounter.reason || "Sans motif"}</strong>{encounter.observations && <p>{encounter.observations}</p>}{Object.keys(encounter.template_responses ?? {}).length > 0 && <dl className="kv">{Object.entries(encounter.template_responses ?? {}).map(([key, value]) => { const field = encounter.template_fields?.find((entry) => entry.key === key); return <div key={key}><dt>{field?.label ?? key}</dt><dd>{typeof value === "boolean" ? (value ? "Oui" : "Non") : String(value)}{field?.unit ? ` ${field.unit}` : ""}</dd></div>; })}</dl>}{encounter.recorded_with_help && <p className="muted">Rempli avec l’aide de : {encounter.recorded_with_help}</p>}</div><span className="badge pending">Brouillon</span></article>)}</div>
    <FormSection num={1} title="Quel est le motif de la consultation ?"><label className="field"><span>Motif</span><input maxLength={240} value={reason} onChange={(event) => setReason(event.target.value)} /></label></FormSection>
    <FormSection num={2} title="Quels symptômes ou maux le patient ressent-il ?" hint="Cochez ce qui correspond (facultatif).">
      <ChipPicker label="Symptômes les plus fréquents" options={SYMPTOMS} selected={symptoms.selected} other={symptoms.other} onSelected={(selected) => setSymptoms({ ...symptoms, selected })} onOther={(other) => setSymptoms({ ...symptoms, other })} otherLabel="Autre symptôme, depuis quand, intensité (facultatif)" otherPlaceholder="Si le symptôme n’est pas dans la liste, écrivez-le ici." maxOther={OTHER_MAX} rows={3} />
      {symptomsTooLong && <p className="status" role="alert">Le texte est trop long : raccourcissez-le.</p>}
    </FormSection>
    <FormSection num={3} title="Quelles constantes ont été relevées ?" hint="Relevées en pré-consultation : relisez, corrigez ou complétez. Tension et glycémie restent telles qu’écrites, sans conversion ni unité supposée."><VitalsPicker value={vitalsForm} onChange={setVitalsForm} /></FormSection>
    <FormSection num={4} title="Examen clinique" hint="Cochez les constats de votre examen (facultatif)."><ChipPicker label="Constats de l’examen clinique" options={CLINICAL_FINDINGS} selected={clinical.selected} other={clinical.other} onSelected={(selected) => setClinical({ ...clinical, selected })} onOther={(other) => setClinical({ ...clinical, other })} otherLabel="Autre constat (facultatif)" /></FormSection>
    <FormSection num={5} title="Diagnostic" hint="Diagnostic ou conclusion : l’un des deux est nécessaire pour signer."><ChipPicker label="Diagnostics les plus fréquents" options={DIAGNOSES} selected={diagnosis.selected} other={diagnosis.other} onSelected={(selected) => setDiagnosis({ ...diagnosis, selected })} onOther={(other) => setDiagnosis({ ...diagnosis, other })} otherLabel="Autre diagnostic (facultatif)" /></FormSection>
    <FormSection num={6} title="Conduite à tenir"><ChipPicker label="Conduite à tenir" options={CARE_PLAN_ITEMS} selected={carePlan.selected} other={carePlan.other} onSelected={(selected) => setCarePlan({ ...carePlan, selected })} onOther={(other) => setCarePlan({ ...carePlan, other })} otherLabel="Autre consigne (facultatif)" /></FormSection>
    <FormSection num={7} title="Conclusion"><ChipPicker label="Conclusion" options={CONCLUSION_ITEMS} selected={conclusion.selected} other={conclusion.other} onSelected={(selected) => setConclusion({ ...conclusion, selected })} onOther={(other) => setConclusion({ ...conclusion, other })} otherLabel="Autre conclusion (facultatif)" /></FormSection>
    <FormSection num={8} title="Ordonnance" hint="Choisissez dans les listes ; « Autre » pour ce qui n’y figure pas."><PrescriptionPicker lines={lines} onChange={setLines} /></FormSection>
    <FormSection num={9} title="Examens demandés" hint="Choisissez l’examen, ou joignez la photo de la demande si vous préférez ne pas le saisir."><ExamPicker exams={exams} onChange={setExams} /></FormSection>
    <p className="muted">Une attestation SVG est enregistrée avec la validation. Elle ne constitue pas une signature électronique qualifiée.</p><ConsultationSeal /><button className="button primary" type="submit" disabled={submitting || !encounterId}>{submitting ? "Signature…" : "Terminer et signer"}</button></>}</>}</form>{selectedGrant && <ProfessionalMeasurementEntry grant={selectedGrant} />}<div className="section-grid"><CollapsibleSection title="Mes consultations" icon="stethoscope" hint="Historique signé"><div className="professional-history"><div className="professional-history__heading"><label className="professional-quick-search"><span className="sr-only">Rechercher établissement ou motif</span><input ref={searchRef} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Établissement, motif…" /><kbd aria-hidden="true">/</kbd></label></div>{loading ? <p className="empty">Chargement…</p> : filteredConsultations.length === 0 ? <p className="empty">{consultations.length ? "Aucun résultat pour cette recherche." : "Aucune consultation validée."}</p> : <div className="professional-compact-list" aria-live="polite">{filteredConsultations.map((item) => <article className="professional-compact-record" key={item.id}><div><strong>{item.reason}</strong><p>{item.facility_label} · {item.provenance.label}</p></div><span className="badge verified">Validée</span></article>)}</div>}</div></CollapsibleSection></div></section></div>;
}
