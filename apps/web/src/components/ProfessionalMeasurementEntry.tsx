"use client";

import { useEffect, useState } from "react";
import { createProfessionalMeasurement, listProfessionalMeasurements, type ProfessionalMeasurement } from "../application/professional-access-grants";
import { ApiError } from "../infrastructure/api/client";
import { MEASUREMENT_TYPES, type MeasurementKind } from "../lib/measurement-types";
import type { ProfessionalGrant } from "../application/professional-access-grants";
import { MeasurementTrends } from "./MeasurementTrends";
import "./professional-measurements.css";

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date indisponible" : date.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

function localDateTimeInputValue(): string {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function accessMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Le service des mesures est indisponible.";
  if (error instanceof ApiError && error.status === 403) {
    if (/propre dossier/i.test(message)) return "Vous ne pouvez pas saisir une mesure dans votre propre dossier. Consultez votre carnet depuis l’espace patient.";
    if (/ne couvre pas/i.test(message)) return "Le périmètre accordé par le patient ne permet pas cette action. Demandez une autorisation couvrant la pré-consultation.";
    if (/n’est plus active|n'est plus active|expir/i.test(message)) return "Cette autorisation a expiré ou a été révoquée. Actualisez vos accès avant de continuer.";
    return `Accès refusé : ${message}`;
  }
  if (error instanceof ApiError && error.status === 404) return "Cette autorisation est introuvable ou ne relève plus de votre établissement actif.";
  return message;
}

export function ProfessionalMeasurementEntry({ grant }: { grant: ProfessionalGrant }) {
  const [items, setItems] = useState<ProfessionalMeasurement[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [kind, setKind] = useState<MeasurementKind>("temperature");
  const [value, setValue] = useState("");
  const [measuredAt, setMeasuredAt] = useState(localDateTimeInputValue);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selected = MEASUREMENT_TYPES.find((item) => item.value === kind) ?? MEASUREMENT_TYPES[0];

  useEffect(() => {
    let active = true;
    listProfessionalMeasurements(grant.id)
      .then((records) => { if (active) { setLoadError(""); setItems(records); } })
      .catch((error: unknown) => { if (active) setLoadError(accessMessage(error)); });
    return () => { active = false; };
  }, [grant.id, reloadKey]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value.trim()) {
      setMessage("Saisissez la valeur de la mesure.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const created = await createProfessionalMeasurement(grant.id, {
        kind,
        value: value.trim(),
        unit: selected.unit,
        measured_at: new Date(measuredAt).toISOString(),
      });
      setItems((current) => [created, ...(current ?? []).filter((item) => item.id !== created.id)]);
      setValue("");
      const professional = created.professional_name || grant.professional_name || "le professionnel autorisé";
      setMessage(`Mesure enregistrée. Provenance : Mesuré par ${professional}. L’enregistrement est journalisé.`);
    } catch (error) {
      setMessage(accessMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return <section className="card professional-measurements" aria-labelledby="professional-measurements-title">
    <div className="section-heading">
      <div><span className="eyebrow">Pré-consultation autorisée</span><h2 id="professional-measurements-title">Ajouter une mesure</h2></div>
      <span className="count-badge" aria-label={`${items?.length ?? 0} mesure(s)`}>{items?.length ?? "…"}</span>
    </div>
    <p className="muted">Les mesures sont rattachées au patient et à votre établissement. Tension et glycémie sont conservées telles que saisies, sans conversion ni interprétation clinique.</p>

    <form className="professional-measurements__form" onSubmit={submit}>
      <label className="field"><span>Mesure</span><select value={kind} onChange={(event) => setKind(event.target.value as MeasurementKind)}>{MEASUREMENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
      <label className="field"><span>Valeur{selected.unit ? ` (${selected.unit})` : ""}</span><input required type={selected.freeText ? "text" : "number"} inputMode={selected.freeText ? "text" : "decimal"} maxLength={selected.freeText ? 32 : undefined} step={selected.freeText ? undefined : selected.step} min={selected.freeText ? undefined : selected.min} max={selected.freeText ? undefined : selected.max} value={value} onChange={(event) => setValue(event.target.value)} placeholder={selected.placeholder} /></label>
      <label className="field"><span>Date et heure</span><input required type="datetime-local" value={measuredAt} onChange={(event) => setMeasuredAt(event.target.value)} /></label>
      <button className="button primary" type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer la mesure"}</button>
    </form>
    <p className="professional-measurements__message" role={message && /refus|autorisation|périmètre|propre dossier|introuvable/i.test(message) ? "alert" : "status"} aria-live="polite">{message}</p>

    <MeasurementTrends records={items} loading={items === null && !loadError} error={loadError || null} />

    <div className="professional-measurements__history" aria-labelledby="professional-measurements-history-title">
      <h3 id="professional-measurements-history-title">Mesures de cet établissement</h3>
      {items === null && !loadError && <p className="empty" role="status">Chargement des mesures autorisées…</p>}
      {loadError && <div className="notice error" role="alert"><p>{loadError}</p><button type="button" className="button" onClick={() => setReloadKey((key) => key + 1)}>Réessayer</button></div>}
      {items && items.length === 0 && <p className="empty">Aucune mesure validée dans cet établissement pour ce patient.</p>}
      {items && items.length > 0 && <ul className="professional-measurements__list">{items.map((item) => {
        const source = item.source === "measured" && item.professional_name ? `Mesuré par ${item.professional_name}` : item.source_label;
        return <li className="record" key={item.id}><div><strong>{item.kind_label}</strong><p className="muted">{item.value}{item.unit ? ` ${item.unit}` : ""} · {formatDate(item.measured_at)}</p><small className="muted">{source}{item.note ? ` · ${item.note}` : ""}</small></div></li>;
      })}</ul>}
    </div>
  </section>;
}
