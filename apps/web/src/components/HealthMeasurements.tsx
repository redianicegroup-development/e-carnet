"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../infrastructure/api/client";
import { describeVitals, VITAL_SOURCE_LABELS, type ConsultationVitals } from "../lib/vitals";
import { PATIENT_MEASUREMENT_TYPES, type HealthMeasurementRecord, type PatientMeasurementKind } from "../lib/measurement-types";
import { Pictogram } from "./ui/Pictogram";
import { MEASUREMENT_PICTOGRAMS, pictogramFor, type PictogramName } from "../lib/pictograms";
import { useDataSaver } from "./data-saver/useDataSaver";

// Les courbes (bibliothèque de graphiques) ne sont téléchargées qu'au moment de les afficher.
const MeasurementTrends = dynamic(() => import("./MeasurementTrends").then((module) => module.MeasurementTrends), { ssr: false, loading: () => <p className="muted" role="status">Chargement des courbes…</p> });

type Measurement = HealthMeasurementRecord;
type Consultation = { id: string; validated_at: string; professional_name: string; vitals: ConsultationVitals };
type HistoryItem = { id: string; kind: string; kind_label: string; value: string; unit: string; measured_at: string; source: "measured" | "declared"; source_label: string; note?: string };

const TYPES = PATIENT_MEASUREMENT_TYPES;
const formatDate = (value: string) => new Date(value).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });

function fromMeasurement(item: Measurement): HistoryItem {
  const source = item.professional_name && item.source === "measured" ? `${item.source_label} par ${item.professional_name}` : item.source_label;
  return { id: `measurement-${item.id}`, kind: item.kind, kind_label: item.kind_label, value: String(item.value), unit: item.unit, measured_at: item.measured_at, source: item.source, source_label: source, note: item.note };
}

function fromConsultation(item: Consultation): HistoryItem[] {
  return describeVitals(item.vitals).map((line) => ({
    id: `consultation-${item.id}-${line.key}`,
    kind: line.key,
    kind_label: line.label,
    value: line.text,
    unit: "",
    measured_at: item.validated_at,
    source: line.source === "professional" ? "measured" : "declared",
    source_label: `Consultation signée · ${line.source ? VITAL_SOURCE_LABELS[line.source] : item.professional_name}`,
  }));
}

export function HealthMeasurements() {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const saver = useDataSaver();
  const [trendsRequested, setTrendsRequested] = useState(false);
  const [kind, setKind] = useState<PatientMeasurementKind>("temperature");
  const [value, setValue] = useState("");
  const [source, setSource] = useState<"measured" | "declared">("measured");
  const [measuredAt, setMeasuredAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = TYPES.find((item) => item.value === kind) ?? TYPES[0];
  const history = useMemo(() => [...(items ?? [])].sort((a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime()), [items]);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiGet<Measurement[]>("/api/v1/patient/care/measurements/"),
      apiGet<Consultation[]>("/api/v1/patient/care/consultations/"),
    ]).then(([measurements, consultations]) => {
      if (active) setItems([...measurements.map(fromMeasurement), ...consultations.flatMap(fromConsultation)]);
    }).catch((error) => {
      if (active) { setItems([]); setMessage(error instanceof Error ? error.message : "Historique des constantes indisponible."); }
    });
    return () => { active = false; };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!value.trim()) { setMessage("Saisissez une valeur ou laissez le champ vide."); return; }
    setBusy(true);
    setMessage("");
    try {
      const created = await apiPost<Measurement>("/api/v1/patient/care/measurements/", { kind, value: value.trim(), unit: selected.unit, source, measured_at: new Date(measuredAt).toISOString() });
      setItems((current) => [...(current ?? []), fromMeasurement(created)]);
      setValue("");
      setMessage("Mesure enregistrée. Sa provenance est conservée dans l’historique.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Mesure refusée."); }
    finally { setBusy(false); }
  }

  const trendRecords = items?.map((item) => ({ id: item.id, kind: item.kind, kind_label: item.kind_label, value: item.value, unit: item.unit, source: item.source, source_label: item.source_label, measured_at: item.measured_at })) ?? null;

  return <section className="card" aria-labelledby="measurements-title">
    <div className="section-heading"><div><span className="eyebrow">Constantes secondaires · variables</span><h2 id="measurements-title">Mes constantes de suivi</h2></div><span className="count-badge">{items?.length ?? "…"}</span></div>
    <p className="muted">Température, saturation, pouls, tension et glycémie peuvent varier : saisissez-les ici comme relevés ponctuels. Ils restent dans le même historique que les constantes des consultations signées. La tension et la glycémie sont conservées telles qu’écrites, sans conversion. Taille et poids de référence se déclarent au-dessus.</p>
    <form className="patient-grid" onSubmit={submit}>
      <label className="field"><span>{pictogramFor(MEASUREMENT_PICTOGRAMS, kind) ? <Pictogram name={pictogramFor(MEASUREMENT_PICTOGRAMS, kind) as PictogramName} size={18} decorative /> : null} Mesure</span><select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>{TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
      <label className="field"><span>Valeur{selected.unit ? ` (${selected.unit})` : ""}</span><input required type={selected.freeText ? "text" : "number"} inputMode={selected.freeText ? "text" : "decimal"} maxLength={selected.freeText ? 24 : undefined} step={selected.freeText ? undefined : selected.step} value={value} onChange={(event) => setValue(event.target.value)} placeholder={selected.placeholder} /></label>
      <label className="field"><span>Origine</span><select value={source} onChange={(event) => setSource(event.target.value as typeof source)}><option value="measured">Mesuré</option><option value="declared">Déclaré</option></select></label>
      <label className="field"><span>Date et heure</span><input required type="datetime-local" value={measuredAt} onChange={(event) => setMeasuredAt(event.target.value)} /></label>
      <button className="button primary" disabled={busy}>{busy ? "Enregistrement…" : "Ajouter la mesure"}</button>
    </form>
    <p className="status" role="status" aria-live="polite">{message}</p>
    {saver.active && !trendsRequested ? <div className="notice" role="status"><p>Courbes masquées pour économiser vos données.</p><button className="button small" type="button" onClick={() => setTrendsRequested(true)}>Afficher les courbes</button></div> : <MeasurementTrends records={trendRecords} loading={items === null} error={items !== null && items.length === 0 && message && /indisponible/i.test(message) ? message : null} />}
    <div className="stack" aria-live="polite" aria-label="Historique unifié des constantes">
      {items === null ? <div className="skeleton" role="status"><span className="sr-only">Chargement…</span><i /></div> : history.length === 0 ? <p className="empty">Aucune constante renseignée pour le moment.</p> : history.map((item) => <article className="record" key={item.id}><div><strong>{item.kind_label}</strong><p className="muted">{item.value}{item.unit ? ` ${item.unit}` : ""} · {formatDate(item.measured_at)}</p><small className="muted">{item.source_label}{item.note ? ` · ${item.note}` : ""}</small></div></article>)}
    </div>
  </section>;
}
