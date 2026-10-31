"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiGet } from "../infrastructure/api/client";

/* Journal d'audit (ADM-07) : lecture seule, réservé à l'équipe d'exploitation. Aucun identifiant de patient n'est affiché ; l'e-mail de l'acteur est masqué.
   Les événements sont immuables côté serveur : il n'existe ni modification ni suppression. */
type AuditEvent = { id: string; created_at: string; event_type: string; actor_role: string; actor: string; establishment: string; concerns_patient: boolean; metadata: Record<string, string | number | boolean> };
type Page = { events: AuditEvent[]; next_before: string | null; immutable: boolean };
type Filters = { type: string; role: string; from: string; to: string };

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "medium" });
const ROLES: Record<string, string> = { patient: "Patient", professional: "Professionnel", establishment_admin: "Administrateur d’établissement", ecarnet_staff: "Équipe Mon E‑Carnet", operations_admin: "Exploitation" };
const EMPTY: Filters = { type: "", role: "", from: "", to: "" };

function query(filters: Filters, extra: Record<string, string> = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, ...extra })) if (value) params.set(key, value);
  return params.toString();
}

export function AdminAuditJournal() {
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const invalidPeriod = Boolean(draft.from && draft.to && draft.from > draft.to);

  const load = useCallback(async (filters: Filters, before?: string) => {
    setState("loading");
    try {
      const page = await apiGet<Page>(`/api/v1/identity/admin/audit/?${query(filters, before ? { before } : {})}`);
      setEvents((current) => (before ? [...current, ...page.events] : page.events));
      setNext(page.next_before);
      setState("ready");
      setMessage("");
    } catch (error) {
      setState("error");
      setMessage(error instanceof ApiError ? error.message : "Le journal est momentanément indisponible.");
    }
  }, []);

  useEffect(() => { void load(applied); }, [applied, load]);

  return (
    <section className="stack-lg" aria-labelledby="admin-audit-title">
      <header className="admin-page-heading">
        <div><span className="eyebrow">Traçabilité</span><h2 id="admin-audit-title">Journal d’audit</h2><p className="muted">Lecture seule. Les événements ne peuvent être ni modifiés ni supprimés. Aucun identifiant de patient n’est affiché.</p></div>
        <a className="button" href={`/api/v1/identity/admin/audit/export/?${query(applied)}`}>Exporter en CSV</a>
      </header>
      <form className="card admin-table-card" onSubmit={(event) => { event.preventDefault(); if (!invalidPeriod) setApplied(draft); }}>
        <div className="grid two">
          <label className="field"><span>Type d’événement (début)</span><input value={draft.type} placeholder="ex. establishment_record." onChange={(event) => setDraft({ ...draft, type: event.target.value.toLowerCase() })} /></label>
          <label className="field"><span>Rôle de l’acteur</span><select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })}><option value="">Tous</option>{Object.entries(ROLES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="field"><span>Du</span><input type="date" value={draft.from} onChange={(event) => setDraft({ ...draft, from: event.target.value })} /></label>
          <label className="field"><span>Au</span><input type="date" value={draft.to} onChange={(event) => setDraft({ ...draft, to: event.target.value })} /></label>
        </div>
        {invalidPeriod ? <p className="notice notice--error" role="alert">La date de fin doit suivre la date de début.</p> : null}
        <div className="actions"><button className="button primary" type="submit" disabled={invalidPeriod}>Filtrer</button><button className="button" type="button" onClick={() => { setDraft(EMPTY); setApplied(EMPTY); }}>Réinitialiser</button></div>
      </form>
      {state === "error" ? <p className="notice notice--error" role="alert">{message}</p> : null}
      <section className="card admin-table-card" aria-busy={state === "loading"}>
        <div className="admin-table-wrap">
          <table className="admin-table admin-table--stack">
            <thead><tr><th>Date</th><th>Événement</th><th>Rôle</th><th>Acteur</th><th>Établissement</th><th>Patient</th><th>Détails</th></tr></thead>
            <tbody>
              {events.map((item) => (
                <tr key={item.id}>
                  <td data-label="Date">{dateFormat.format(new Date(item.created_at))}</td>
                  <td data-label="Événement"><code>{item.event_type}</code></td>
                  <td data-label="Rôle">{ROLES[item.actor_role] ?? item.actor_role}</td>
                  <td data-label="Acteur">{item.actor || "—"}</td>
                  <td data-label="Établissement">{item.establishment || "—"}</td>
                  <td data-label="Patient">{item.concerns_patient ? "Concerné" : "—"}</td>
                  <td data-label="Détails">{Object.entries(item.metadata).map(([key, value]) => `${key} : ${String(value)}`).join(" · ") || "—"}</td>
                </tr>
              ))}
              {state === "ready" && events.length === 0 ? <tr><td colSpan={7}>Aucun événement pour ces filtres.</td></tr> : null}
            </tbody>
          </table>
        </div>
        {state === "loading" ? <p className="muted" role="status">Chargement…</p> : null}
        {next && state !== "loading" ? <div className="actions"><button className="button" type="button" onClick={() => void load(applied, next)}>Charger les événements plus anciens</button></div> : null}
      </section>
    </section>
  );
}
