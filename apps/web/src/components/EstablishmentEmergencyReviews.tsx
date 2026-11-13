"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiGet, apiPost } from "../infrastructure/api/client";
import {
  BREAK_GLASS_API, BREAK_GLASS_MAX_REVIEW_NOTE, REVIEW_STATE_LABELS, isBreakGlassDisabled,
  type EmergencyReviewItem,
} from "../lib/break-glass";
import { PageHeader } from "./ui/PageHeader";
import "./break-glass.css";

type Establishment = { id: string; name: string; status: string };

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function ReviewForm({ item, establishmentId, onDone }: { item: EmergencyReviewItem; establishmentId: string; onDone: () => void }) {
  const [outcome, setOutcome] = useState<"" | "justified" | "unjustified">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const missingNote = outcome === "unjustified" && !note.trim();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!outcome || missingNote || busy) return;
    setBusy(true); setError("");
    try { await apiPost(`${BREAK_GLASS_API}/establishment/${establishmentId}/emergency-access/${item.id}/review/`, { outcome, note: note.trim() }); onDone(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible d’enregistrer la revue."); }
    finally { setBusy(false); }
  }

  return <form className="break-glass-review" onSubmit={submit}>
    <fieldset className="reason-options"><legend>Cet accès était-il justifié ?</legend>
      <label><input type="radio" name={`outcome-${item.id}`} checked={outcome === "justified"} onChange={() => setOutcome("justified")} />Justifié : urgence réelle, accès proportionné</label>
      <label><input type="radio" name={`outcome-${item.id}`} checked={outcome === "unjustified"} onChange={() => setOutcome("unjustified")} />Non justifié : abus à signaler</label>
    </fieldset>
    {outcome === "unjustified" && <label className="field"><span>Pourquoi ? <small>(joint au signalement et envoyé au patient)</small></span>
      <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={BREAK_GLASS_MAX_REVIEW_NOTE} required /></label>}
    {outcome === "justified" && <label className="field"><span>Remarque <small>(facultative)</small></span>
      <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={BREAK_GLASS_MAX_REVIEW_NOTE} /></label>}
    {error && <p className="notice error" role="alert">{error}</p>}
    <div className="actions"><button className={`button ${outcome === "unjustified" ? "danger" : "primary"}`} type="submit" disabled={!outcome || missingNote || busy}>{busy ? "Enregistrement…" : outcome === "unjustified" ? "Signaler l’abus" : "Valider la revue"}</button></div>
    <p className="muted"><small>La décision est définitive. Un abus est signalé à l’équipe Mon E‑Carnet et au patient ; la sanction (par exemple suspendre le rattachement du professionnel) se décide ensuite.</small></p>
  </form>;
}

export function EstablishmentEmergencyReviews() {
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [items, setItems] = useState<EmergencyReviewItem[] | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const establishments = await apiGet<Establishment[]>("/api/v1/establishments/");
      const current = establishments[0] ?? null;
      setEstablishment(current);
      if (!current || current.status !== "active") { setItems([]); return; }
      const data = await apiGet<{ enabled: boolean; items: EmergencyReviewItem[] }>(`${BREAK_GLASS_API}/establishment/${current.id}/emergency-access/`);
      setItems(data.items); setError("");
    } catch (cause) { if (isBreakGlassDisabled(cause)) setDisabled(true); else setError(cause instanceof Error ? cause.message : "Les accès d’urgence sont indisponibles."); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- chargement initial depuis l’API.
  useEffect(() => { void load(); }, []);

  const header = <PageHeader eyebrow={establishment?.name} title="Accès d’urgence à revoir" lead="Chaque accès d’urgence de votre établissement doit être relu sous 72 h." />;
  if (disabled) return <div className="stack-lg">{header}<section className="card"><p className="empty">L’accès d’urgence n’est pas activé sur cette installation.</p></section></div>;
  if (error && !items) return <div className="stack-lg">{header}<p className="notice error" role="alert">{error}</p></div>;
  if (!items) return <div className="stack-lg">{header}<div className="skeleton" role="status"><span className="sr-only">Chargement…</span><i /><i /></div></div>;

  const todo = items.filter((item) => item.review_state !== "done");
  const done = items.filter((item) => item.review_state === "done");
  return <div className="stack-lg">{header}
    {error && <p className="notice error" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
    {todo.length === 0 && <section className="card"><p className="empty">Aucun accès d’urgence en attente de revue.</p></section>}
    {todo.map((item) => <article key={item.id} className={`card break-glass-item break-glass-item--${item.review_state}`}>
      <header><h2>{item.professional_name}</h2><span className={`badge ${item.review_state === "overdue" ? "contested" : "declared"}`}>{REVIEW_STATE_LABELS[item.review_state]}</span></header>
      <dl className="break-glass-item__facts">
        <div><dt>Patient</dt><dd>{item.patient_name}</dd></div>
        <div><dt>Ouvert le</dt><dd>{formatDateTime(item.requested_at)}</dd></div>
        <div><dt>Motif</dt><dd>{item.reason_label}</dd></div>
        <div><dt>Revue avant le</dt><dd>{formatDateTime(item.review_due_at)}</dd></div>
      </dl>
      <blockquote className="break-glass-item__note">{item.reason_note}</blockquote>
      {item.is_own ? <p className="muted">C’est votre propre accès : un autre administrateur doit le revoir.</p>
        : !item.can_review ? <p className="muted">L’accès est encore ouvert. Revenez une fois la fenêtre terminée ({formatDateTime(item.expires_at)}).</p>
        : openId === item.id ? <ReviewForm item={item} establishmentId={establishment!.id} onDone={() => { setOpenId(""); setMessage("Revue enregistrée."); void load(); }} />
        : <div className="actions"><button type="button" className="button primary" onClick={() => setOpenId(item.id)}>Revoir cet accès</button></div>}
    </article>)}
    {done.length > 0 && <section className="card"><h2>Déjà revus</h2>
      <ul className="break-glass-list">{done.map((item) => <li key={item.id}><span><strong>{item.professional_name}</strong> · {item.patient_name}<br /><small className="muted">{formatDateTime(item.requested_at)} · {item.reason_label}</small></span><span className={`badge ${item.review?.outcome === "unjustified" ? "contested" : "verified"}`}>{item.review?.outcome_label}</span></li>)}</ul></section>}
  </div>;
}
