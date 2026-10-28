"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiGet, apiPatch } from "../infrastructure/api/client";

type ComponentStatus = { status: string; duration_ms?: number; vendor?: string; backend?: string; configured?: boolean; directory_exists?: boolean; writable?: boolean; error?: string };
type OperationsSummary = {
  generated_at: string;
  status: "ok" | "warning" | "error";
  environment: string;
  version: string;
  components: { database: ComponentStatus; cache: ComponentStatus; media: ComponentStatus };
  incidents: Incident[];
  configuration: { operations_email_allowlist_configured: boolean; smtp_configured: boolean; database_configured: boolean; external_monitoring_url_configured: boolean };
  limitations: string[];
};
type Incident = { id: string; incident_key: string; severity: string; category: string; status: "open" | "acknowledged" | "resolved"; summary: string; first_seen_at: string; last_seen_at: string; resolved_at: string | null; resolution_note: string };

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const formatDate = (value: string) => dateFormat.format(new Date(value));
const statusLabel: Record<string, string> = { ok: "Opérationnel", warning: "À vérifier", error: "En erreur", not_configured: "Non configuré" };
const statusClass = (status: string) => status === "ok" ? "is-ok" : status === "error" ? "is-error" : "is-warning";
const incidentLabel: Record<string, string> = { open: "Ouvert", acknowledged: "Reconnu", resolved: "Résolu" };

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge admin-operations-status ${statusClass(status)}`}><span aria-hidden="true">●</span> {statusLabel[status] ?? status}</span>;
}

export function AdminOperationsClient() {
  const [data, setData] = useState<OperationsSummary | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [incidentBusy, setIncidentBusy] = useState("");

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      setData(await apiGet<OperationsSummary>("/api/v1/identity/admin/operations/summary/"));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof ApiError && (error.status === 401 || error.status === 403) ? "Votre compte n’est pas autorisé pour la surveillance technique." : error instanceof Error ? error.message : "Impossible de charger l’état technique.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  async function updateIncident(incident: Incident, action: "acknowledge" | "resolve") {
    setIncidentBusy(incident.id);
    try {
      await apiPatch(`/api/v1/identity/admin/operations/incidents/${incident.id}/`, { action, resolution_note: action === "resolve" ? "Traité depuis la console opérations." : undefined });
      await load(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible de mettre à jour l’incident.");
    } finally { setIncidentBusy(""); }
  }

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 60_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [load]);

  if (loading && !data) return <section className="card"><p className="status" role="status">Lecture de l’état technique…</p></section>;
  if (!data) return <section className="card"><p className="notice" role="alert">{message || "État technique indisponible."}</p><button className="button" type="button" onClick={() => void load(true)}>Réessayer</button></section>;

  const entries: Array<[string, string, ComponentStatus]> = [["Base de données", "PostgreSQL ou moteur configuré", data.components.database], ["Cache / rate limiting", data.components.cache.backend ?? "Backend Django", data.components.cache], ["Stockage privé", "Répertoire médias de l’instance", data.components.media]];
  return <section className="stack-lg" aria-label="Surveillance technique">
    <div className="admin-operations-header"><div><span className="eyebrow">Exploitation</span><h2>Surveillance technique</h2><p className="muted">Résumé sans contenu médical · dernière lecture {formatDate(data.generated_at)}</p></div><div className="admin-inline-actions"><StatusBadge status={data.status} /><button className="button small" type="button" disabled={refreshing} onClick={() => void load(true)}>{refreshing ? "Actualisation…" : "Actualiser"}</button></div></div>
    {message && <p className="notice" role="status">{message}</p>}
    <div className="admin-metrics admin-metrics--compact"><article className="card admin-metric"><span className="muted">API</span><strong><StatusBadge status={data.status} /></strong><small>{data.environment} · version {data.version}</small></article><article className="card admin-metric"><span className="muted">Base</span><strong><StatusBadge status={data.components.database.status} /></strong><small>{data.components.database.duration_ms ?? "—"} ms de contrôle</small></article><article className="card admin-metric"><span className="muted">Cache</span><strong><StatusBadge status={data.components.cache.status} /></strong><small>Lecture/écriture de contrôle</small></article><article className="card admin-metric"><span className="muted">Stockage local</span><strong><StatusBadge status={data.components.media.status} /></strong><small>La capacité Hodi vient d’un monitoring externe</small></article></div>
    <section className="card admin-table-card"><div className="admin-table-title"><div><span className="eyebrow">Dépendances</span><h3>Contrôles de disponibilité</h3></div></div><div className="admin-feedback-list">{entries.map(([label, detail, item]) => <article className="admin-feedback-item" key={label}><div className="admin-feedback-head"><div><strong>{label}</strong><p className="muted">{detail}</p></div><StatusBadge status={item.status} /></div><small>{item.duration_ms !== undefined ? `Contrôle en ${item.duration_ms} ms` : item.error ? `Type d’échec : ${item.error}` : "État contrôlé"}</small></article>)}</div></section>
    <section className="card admin-table-card"><div className="admin-table-title"><div><span className="eyebrow">Incidents</span><h3>Incidents techniques ouverts</h3></div><span className="muted">{data.incidents.length} actif(s)</span></div>{data.incidents.length === 0 ? <p className="empty">Aucun incident ouvert ou reconnu.</p> : <div className="admin-feedback-list">{data.incidents.map((incident) => <article className="admin-feedback-item" key={incident.id}><div className="admin-feedback-head"><div><strong>{incident.summary}</strong><p className="muted">{incident.category} · {incident.severity} · depuis {formatDate(incident.first_seen_at)}</p></div><span className={`badge ${incident.status === "open" ? "refused" : "pending"}`}>{incidentLabel[incident.status]}</span></div><div className="admin-inline-actions"><small>Dernière observation : {formatDate(incident.last_seen_at)}</small>{incident.status === "open" && <button className="button small" type="button" disabled={incidentBusy === incident.id} onClick={() => void updateIncident(incident, "acknowledge")}>Reconnaître</button>}<button className="button small" type="button" disabled={incidentBusy === incident.id} onClick={() => void updateIncident(incident, "resolve")}>Marquer résolu</button></div></article>)}</div>}<p className="admin-privacy-note">Les incidents sont techniques et ne doivent jamais contenir de nom, identifiant ou contenu de carnet.</p></section>
    <section className="card admin-table-card"><div className="admin-table-title"><div><span className="eyebrow">Configuration</span><h3>Portes d’exploitation</h3></div></div><div className="admin-feedback-list"><p className="muted">Liste d’e-mails opérations : <strong>{data.configuration.operations_email_allowlist_configured ? "configurée" : "non configurée (mode local superadmin)"}</strong></p><p className="muted">Base PostgreSQL externe : <strong>{data.configuration.database_configured ? "configurée" : "non configurée"}</strong></p><p className="muted">SMTP : <strong>{data.configuration.smtp_configured ? "configuré" : "non configuré"}</strong></p><p className="muted">Sonde externe : <strong>{data.configuration.external_monitoring_url_configured ? "URL configurée" : "à connecter"}</strong></p></div></section>
    <section className="card"><h3>Limites de cet écran</h3><ul>{data.limitations.map((item) => <li key={item}>{item}</li>)}</ul><p className="admin-privacy-note">Cet écran ne remplace pas une sonde externe : si l’API est complètement arrêtée, l’alerte doit venir d’un service indépendant.</p></section>
  </section>;
}
