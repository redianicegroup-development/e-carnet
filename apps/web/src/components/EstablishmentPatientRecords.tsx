"use client";
import { useEffect, useId, useRef, useState } from "react";
import { apiGet, apiPost } from "../infrastructure/api/client";
import type { ConsultationRecord } from "../lib/care-records";
import { ConsultationCard } from "./consultation/ConsultationCard";
import "./consultation/consultation-card.css";
import { PageHeader } from "./ui/PageHeader";
import { AvatarBadge } from "./shell/SpaceShell";
import { useDialogBehavior } from "./modal/useDialogBehavior";
import "./join-codes.css";
import "./establishment-patient-records.css";
type Establishment = { id: string; name: string; status: string };
type Patient = { id: string; first_name: string; last_name: string; age?: number | null; avatar_url?: string; last_service_at?: string | null };
type Data = { establishment: Establishment | null; patients: Patient[] };
type ClinicalData = { opening_id: string; patient: Patient; records: Record<string, Record<string, unknown>[]> };
const REASONS = [["urgence", "Urgence"], ["soins_en_cours", "Soins en cours"], ["continuite_soins", "Continuité des soins"], ["demande_patient", "Demande du patient"], ["facturation_assurance", "Facturation / assurance"], ["qualite_audit", "Qualité / audit"], ["reclamation", "Réclamation"], ["autre", "Autre"]] as const;
async function fetchRecords(): Promise<Data> {
  const establishments = await apiGet<Establishment[]>("/api/v1/establishments/");
  const establishment = establishments[0] ?? null;
  if (!establishment || establishment.status !== "active") return { establishment, patients: [] };
  const page = await apiGet<{ items: Patient[] }>(`/api/v1/establishments/${establishment.id}/patients/?page_size=100`);
  return { establishment, patients: page.items ?? [] };
}
function formatDate(value?: string | null) { return value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Date non renseignée"; }
const DATE_KEYS = ["measured_at", "administered_on", "document_date", "validated_at", "confirmed_at", "closed_at", "started_at", "occurred_at", "created_at"] as const;
const HIDDEN_KEYS = new Set(["id", "patient", "download_url", "updated_at", "establishment_id", "professional_id", "proof_document_id", "exam_request_id", "document_id", "document_type", "content_type", "size_bytes", "verified", "status"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T|$)/;
/** Date d'une ligne clinique : la première date « métier » disponible (mesure, administration, document, validation…). */
function rowDate(row: Record<string, unknown>): string | null {
  for (const key of DATE_KEYS) { const value = row[key]; if (typeof value === "string" && ISO_DATE.test(value)) return value; }
  return null;
}
function formatRowDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", value.includes("T") ? { dateStyle: "long", timeStyle: "short" } : { dateStyle: "long" }).format(new Date(value));
}
function fieldLabel(key: string) { const text = key.replaceAll("_", " ").replace(/\s(at|on)$/, ""); return text.charAt(0).toUpperCase() + text.slice(1); }
function fieldValue(value: unknown) { return typeof value === "string" && ISO_DATE.test(value) ? formatRowDate(value) : typeof value === "boolean" ? (value ? "Oui" : "Non") : String(value); }
function PatientAvatar({ patient, size = 64 }: { patient: Patient; size?: number }) {
  return <AvatarBadge size={size} account={{ first_name: patient.first_name ?? "", last_name: patient.last_name ?? "", email: "", avatar_url: patient.avatar_url ?? "" }} />;
}
/* Fiche simple du patient : identité et dernier soin. Le contenu du dossier n'apparaît qu'après le choix d'un motif (étape suivante). */
function PatientDetail({ patient, onClose, onOpen }: { patient: Patient; onClose: () => void; onOpen: () => void }) {
  const dialog = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useDialogBehavior({ open: true, container: dialog, initialFocus: closeButton, onEscape: onClose });
  const rows: [string, string][] = [
    ["Nom", patient.last_name || "Non renseigné"],
    ["Prénoms", patient.first_name || "Non renseigné"],
    ["Âge", typeof patient.age === "number" ? `${patient.age} an${patient.age > 1 ? "s" : ""}` : "Non renseigné"],
    ["Dernier soin", formatDate(patient.last_service_at)],
  ];
  return <div className="modal-backdrop modal-backdrop--confirm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialog} className="modal-dialog team-detail" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <PatientAvatar patient={patient} size={84} />
      <h2 id={titleId}>{[patient.first_name, patient.last_name].filter(Boolean).join(" ") || "Patient sans nom"}</h2>
      <dl className="team-detail__list">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <p className="muted">Le contenu du dossier s’affiche après le choix d’un motif. Chaque ouverture est notifiée au patient.</p>
      <div className="modal-actions">
        <button ref={closeButton} type="button" className="button" onClick={onClose}>Fermer</button>
        <button type="button" className="button primary" onClick={onOpen}>Voir le dossier</button>
      </div>
    </section>
  </div>;
}
function reasonLabel(value: string) { return REASONS.find(([key]) => key === value)?.[1] ?? "Motif enregistré"; }
/** Une ligne « consultation » complète (le serveur renvoie le même contenu qu'au patient) ; sinon l'affichage générique reste en place. */
function isConsultationRow(row: Record<string, unknown>): boolean {
  const provenance = row.provenance as { label?: unknown } | null | undefined;
  return typeof row.id === "string" && typeof row.reason === "string" && typeof row.validated_at === "string" && Array.isArray(row.prescription_lines) && Array.isArray(row.exam_requests) && typeof provenance?.label === "string";
}
function ClinicalSection({ name, rows }: { name: string; rows: Record<string, unknown>[] }) {
  if (!rows.length) return null;
  const labels: Record<string, string> = { preconsultations: "Pré-consultations", consultations: "Consultations", measurements: "Mesures", documents: "Documents", vaccinations: "Vaccinations" };
  // Consultations validées : même carte que chez le patient et le médecin (compte rendu, ordonnance, examens, validation). Les images de signature
  // et de cachet ne sont servies qu'au patient et au médecin signataire : l'établissement voit seulement qu'elles ont été apposées.
  if (name === "consultations" && rows.every(isConsultationRow)) {
    return <section className="record"><h2>{labels[name]}</h2><div className="consult-list">{(rows as unknown as ConsultationRecord[]).map((row, index) => <ConsultationCard key={row.id} item={row} index={index} sealImages={false} />)}</div></section>;
  }
  // Informations datées : chaque ligne s'ouvre sur sa date, les plus récentes en premier.
  const dated = rows.map((row) => ({ row, date: rowDate(row) })).sort((left, right) => (right.date ? Date.parse(right.date) : 0) - (left.date ? Date.parse(left.date) : 0));
  return <section className="record"><h2>{labels[name] ?? name}</h2>{dated.map(({ row, date }, index) => <article key={String(row.id ?? index)} className="establishment-record-card">
    <h3>{date ? <time dateTime={date}>{formatRowDate(date)}</time> : "Date non renseignée"}</h3>
    {Object.entries(row).filter(([key, value]) => !HIDDEN_KEYS.has(key) && value !== null && value !== "" && typeof value !== "object" && !(date && row[key] === date)).map(([key, value]) => <p key={key}><strong>{fieldLabel(key)} :</strong> {fieldValue(value)}</p>)}
  </article>)}</section>;
}
export function EstablishmentPatientRecords() {
  const [data, setData] = useState<Data | null>(null); const [error, setError] = useState(""); const [selected, setSelected] = useState<Patient | null>(null); const [detail, setDetail] = useState<Patient | null>(null);
  const [reason, setReason] = useState(""); const [note, setNote] = useState(""); const [record, setRecord] = useState<ClinicalData | null>(null); const [openingId, setOpeningId] = useState("");
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [openedAt, setOpenedAt] = useState("");
  useEffect(() => { let active = true; fetchRecords().then((value) => { if (active) { setData(value); setError(""); } }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Les dossiers sont indisponibles."); }); return () => { active = false; }; }, []);
  async function openRecord() {
    if (!data?.establishment || !selected || !reason) return; setBusy(true); setError(""); setMessage("");
    try { const created = await apiPost<{ opening_id: string; opened_at: string }>(`/api/v1/establishments/${data.establishment.id}/patients/${selected.id}/openings/`, { reason_category: reason, ...(reason === "autre" ? { reason_note: note } : {}) }); setOpeningId(created.opening_id); setOpenedAt(created.opened_at); const opened = await apiGet<ClinicalData>(`/api/v1/establishments/${data.establishment.id}/openings/${created.opening_id}/record/`); setRecord(opened); setSelected(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible d’ouvrir ce dossier."); } finally { setBusy(false); }
  }
  async function closeRecord() {
    if (!data?.establishment || !openingId) return; setBusy(true); setError("");
    try { await apiPost(`/api/v1/establishments/${data.establishment.id}/openings/${openingId}/close/`, {}); setRecord(null); setOpeningId(""); setMessage("Dossier clôturé. Le patient en a été informé."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de clôturer cette ouverture."); } finally { setBusy(false); }
  }
  if (error && !data) return <p className="notice" role="alert">{error}</p>;
  if (!data) return <div className="skeleton" role="status"><span className="sr-only">Chargement des dossiers…</span><i /><i /></div>;
  if (!data.establishment) return <p className="notice" role="alert">Aucun établissement n’est rattaché à ce compte.</p>;
  const patientName = record ? [record.patient.first_name, record.patient.last_name].filter(Boolean).join(" ") : "";
  return <div className="stack-lg"><PageHeader eyebrow={data.establishment.name} title="Dossiers patients" lead="L’accès à chaque dossier est motivé, limité à votre établissement et journalisé." />
    {error && <p className="notice" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
    {record ? <><aside className="establishment-record-banner" aria-label="Ouverture de dossier active"><strong>Dossier ouvert · {reasonLabel(reason)}</strong><span>Ouvert le {formatDate(openedAt)}</span><button className="button danger" type="button" disabled={busy} onClick={() => void closeRecord()}>Clôturer</button></aside><section className="card"><h2>{patientName || "Dossier patient"}</h2><p className="muted">Contenu clinique de cet établissement uniquement.</p></section>{Object.entries(record.records).map(([name, rows]) => <ClinicalSection key={name} name={name} rows={rows} />)}</>
      : data.establishment.status !== "active" ? <section className="card alert-card"><h2>Accès temporairement indisponible</h2><p>Les dossiers de l’établissement ne sont accessibles que lorsque sa structure est active.</p></section>
      : data.patients.length === 0 ? <section className="card"><p className="empty">Aucun dossier patient n’est encore associé à cet établissement.</p></section>
      : <section className="card" aria-labelledby="patients-grid-title">
        <div className="section-heading"><div><h2 id="patients-grid-title">Patients de l’établissement</h2></div><span className="count-badge">{data.patients.length}</span></div>
        <ul className="patient-grid" aria-label="Dossiers de l’établissement">{data.patients.map((patient) => {
          const fullName = [patient.first_name, patient.last_name].filter(Boolean).join(" ") || "Patient sans nom";
          return <li key={patient.id}><button type="button" className="patient-tile" aria-label={`Voir la fiche de ${fullName}`} onClick={() => setDetail(patient)}><PatientAvatar patient={patient} size={64} /><span className="patient-tile__name">{patient.first_name || patient.last_name || "Patient"}</span></button></li>;
        })}</ul>
      </section>}
    {detail && <PatientDetail patient={detail} onClose={() => setDetail(null)} onOpen={() => { setSelected(detail); setReason(""); setNote(""); setDetail(null); }} />}
    {selected && <div className="modal-backdrop" role="presentation"><section className="modal-dialog establishment-record-dialog" role="dialog" aria-modal="true" aria-labelledby="opening-title"><h2 id="opening-title">Pourquoi ouvrir ce dossier ?</h2><fieldset className="reason-options"><legend>Choisissez un motif</legend>{REASONS.map(([value, label]) => <label key={value}><input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)} />{label}</label>)}</fieldset>{reason === "autre" && <label className="field">Précision (140 caractères maximum)<textarea maxLength={140} value={note} onChange={(event) => setNote(event.target.value)} required /><small>{note.length}/140</small></label>}<div className="modal-actions"><button type="button" className="button" onClick={() => setSelected(null)}>Annuler</button><button type="button" className="button primary" disabled={busy || !reason || (reason === "autre" && !note.trim())} onClick={() => void openRecord()}>{busy ? "Ouverture…" : "Continuer"}</button></div></section></div>}
    <p className="notice"><strong>Périmètre d’accès.</strong> Seules les données associées à cet établissement sont affichées. Chaque ouverture est notifiée au patient.</p>
  </div>;
}
