"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../infrastructure/api/client";

type Measurement = { id: string; kind: string; kind_label: string; value: string; unit: string; source: "measured" | "declared"; source_label: string; measured_at: string; note: string };
const TYPES = [{ value: "weight", label: "Poids", unit: "kg" }, { value: "temperature", label: "Température", unit: "°C" }, { value: "heart_rate", label: "Pouls", unit: "bpm" }, { value: "blood_pressure_systolic", label: "Tension systolique", unit: "mmHg" }, { value: "blood_pressure_diastolic", label: "Tension diastolique", unit: "mmHg" }, { value: "glycemia", label: "Glycémie", unit: "g/L" }];

export function HealthMeasurements() {
  const [items, setItems] = useState<Measurement[] | null>(null);
  const [kind, setKind] = useState("weight");
  const [value, setValue] = useState("");
  const [source, setSource] = useState<"measured" | "declared">("measured");
  const [measuredAt, setMeasuredAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = TYPES.find((item) => item.value === kind) ?? TYPES[0];
  useEffect(() => { let active = true; apiGet<Measurement[]>("/api/v1/patient/care/measurements/").then((data) => active && setItems(data)).catch(() => active && setItems([])); return () => { active = false; }; }, []);
  const trends = useMemo(() => Object.fromEntries(TYPES.map((type) => [type.value, (items ?? []).filter((item) => item.kind === type.value).slice(0, 5)])), [items]);
  async function submit(event: React.FormEvent) { event.preventDefault(); setBusy(true); setMessage(""); try { const created = await apiPost<Measurement>("/api/v1/patient/care/measurements/", { kind, value, unit: selected.unit, source, measured_at: new Date(measuredAt).toISOString() }); setItems((current) => [created, ...(current ?? [])]); setValue(""); setMessage("Mesure enregistrée. Elle reste marquée selon sa provenance."); } catch (error) { setMessage(error instanceof Error ? error.message : "Mesure refusée."); } finally { setBusy(false); } }
  return <section className="card" aria-labelledby="measurements-title"><div className="section-heading"><div><span className="eyebrow">Prévention et suivi</span><h2 id="measurements-title">Mes mesures</h2></div><span className="count-badge">{items?.length ?? "…"}</span></div><p className="muted">Saisissez une mesure ponctuelle. Cette version ne pose aucun diagnostic et ne remplace pas un avis médical.</p><form className="patient-grid" onSubmit={submit}><label className="field"><span>Mesure</span><select value={kind} onChange={(event) => setKind(event.target.value)}>{TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label><label className="field"><span>Valeur ({selected.unit})</span><input required type="number" step="0.01" value={value} onChange={(event) => setValue(event.target.value)} /></label><label className="field"><span>Origine</span><select value={source} onChange={(event) => setSource(event.target.value as typeof source)}><option value="measured">Mesuré</option><option value="declared">Déclaré</option></select></label><label className="field"><span>Date et heure</span><input required type="datetime-local" value={measuredAt} onChange={(event) => setMeasuredAt(event.target.value)} /></label><button className="button primary" disabled={busy}>{busy ? "Enregistrement…" : "Ajouter la mesure"}</button></form><p className="status" role="status" aria-live="polite">{message}</p><div className="stack">{TYPES.map((type) => <div className="record" key={type.value}><div><strong>{type.label}</strong><p className="muted">{trends[type.value]?.length ? trends[type.value].map((item) => `${item.value} ${item.unit} · ${new Date(item.measured_at).toLocaleDateString("fr-FR")}`).join(" · ") : "Aucune mesure"}</p></div></div>)}</div></section>;
}
