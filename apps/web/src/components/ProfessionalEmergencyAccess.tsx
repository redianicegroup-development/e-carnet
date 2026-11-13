"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiGet, apiPost } from "../infrastructure/api/client";
import {
  BREAK_GLASS_API, BREAK_GLASS_MAX_NOTE, formatCountdown, isBreakGlassDisabled, noteProblem, secondsLeft,
  type EmergencyAccess, type EmergencyLine, type EmergencyOpened, type EmergencyOverview, type EmergencySummary,
} from "../lib/break-glass";
import { PageHeader } from "./ui/PageHeader";
import "./break-glass.css";

const URL_ROOT = `${BREAK_GLASS_API}/professional/emergency-access/`;

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatClock(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function Lines({ title, lines, empty }: { title: string; lines: EmergencyLine[]; empty: string }) {
  return <section className="break-glass-card__block"><h3>{title}</h3>
    {lines.length === 0 ? <p className="muted">{empty}</p> : <ul>{lines.map((line, index) => <li key={`${line.label}-${index}`}><strong>{line.label}</strong>{line.details && <span> — {line.details}</span>}</li>)}</ul>}
  </section>;
}

function SummaryCard({ summary, access, left }: { summary: EmergencySummary; access: EmergencyAccess; left: number }) {
  return <section className="card break-glass-card" aria-labelledby="break-glass-summary">
    <header className="break-glass-card__head">
      <div><span className="eyebrow">Fiche d’urgence</span><h2 id="break-glass-summary">{[summary.first_name, summary.last_name].filter(Boolean).join(" ")}</h2></div>
      <div className="break-glass-timer" role="timer" aria-live="off"><span>Accès ouvert encore</span><strong>{formatCountdown(left)}</strong><small>jusqu’à {formatClock(access.expires_at)}</small></div>
    </header>
    <div className="break-glass-card__blood"><span>Groupe sanguin</span><strong>{summary.blood_group || "Non renseigné"}</strong></div>
    <Lines title="Allergies" lines={summary.allergies} empty="Aucune allergie déclarée." />
    <Lines title="Traitements en cours" lines={summary.treatments} empty="Aucun traitement déclaré." />
    <Lines title="Antécédents déclarés" lines={summary.antecedents} empty="Aucun antécédent déclaré." />
    <p className="muted break-glass-card__source">{summary.provenance}. Le patient et ses personnes de confiance ont été prévenus ; votre établissement relira cet accès.</p>
  </section>;
}

export function ProfessionalEmergencyAccess() {
  const [overview, setOverview] = useState<EmergencyOverview | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [opened, setOpened] = useState<EmergencyOpened | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ last_name: "", first_name: "", birth_date: "", phone: "", reason_category: "", reason_note: "", confirmed: false });

  async function refresh() {
    try { setOverview(await apiGet<EmergencyOverview>(URL_ROOT)); setLoadError(""); }
    catch (cause) { if (isBreakGlassDisabled(cause)) setDisabled(true); else setLoadError(cause instanceof Error ? cause.message : "L’accès d’urgence est indisponible."); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- chargement initial depuis l’API.
  useEffect(() => { void refresh(); }, []);

  // Le compte à rebours tourne tant qu'une fiche est affichée ; à zéro, la fiche disparaît de l'écran : l'accès est fini, il ne se renouvelle pas.
  const expiresAt = opened?.access.expires_at ?? "";
  const left = expiresAt ? secondsLeft(expiresAt, now) : 0;
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);
  useEffect(() => {
    if (opened && left === 0) { setOpened(null); void refresh(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seule la fin du délai déclenche la fermeture.
  }, [left, opened]);

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const noteError = form.reason_note ? noteProblem(form.reason_note) : "";
  const complete = Boolean(form.last_name.trim() && form.first_name.trim() && form.birth_date && form.reason_category && !noteProblem(form.reason_note) && form.confirmed);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!complete || busy) return;
    setBusy(true); setError("");
    try {
      const result = await apiPost<EmergencyOpened>(URL_ROOT, {
        last_name: form.last_name.trim(), first_name: form.first_name.trim(), birth_date: form.birth_date, phone: form.phone.trim(),
        reason_category: form.reason_category, reason_note: form.reason_note.trim(),
      });
      setNow(Date.now()); setOpened(result);
      // L'identité saisie et le motif ne restent pas dans le formulaire une fois l'accès ouvert.
      setForm({ last_name: "", first_name: "", birth_date: "", phone: "", reason_category: "", reason_note: "", confirmed: false });
      void refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible d’ouvrir l’accès d’urgence."); }
    finally { setBusy(false); }
  }

  async function reopen(item: EmergencyAccess) {
    setBusy(true); setError("");
    try { setNow(Date.now()); setOpened(await apiGet<EmergencyOpened>(`${URL_ROOT}${item.id}/`)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Cet accès n’est plus disponible."); void refresh(); }
    finally { setBusy(false); }
  }

  const header = <PageHeader eyebrow="Urgence vitale" title="Accès d’urgence" lead="Réservé au patient qui ne peut pas consentir : inconscient ou en danger vital." />;
  if (disabled) return <div className="stack-lg">{header}<section className="card"><p className="empty">L’accès d’urgence n’est pas activé sur cette installation.</p></section></div>;
  if (loadError && !overview) return <div className="stack-lg">{header}<p className="notice error" role="alert">{loadError}</p></div>;
  if (!overview) return <div className="stack-lg">{header}<div className="skeleton" role="status"><span className="sr-only">Chargement…</span><i /><i /></div></div>;

  const active = overview.items.filter((item) => item.status === "active");
  return <div className="stack-lg">{header}
    {error && <p className="notice error" role="alert">{error}</p>}
    {opened && <SummaryCard summary={opened.summary} access={opened.access} left={left} />}
    {!opened && active.length > 0 && <section className="card"><h2>Accès encore ouvert</h2>
      <ul className="break-glass-list">{active.map((item) => <li key={item.id}><span><strong>{item.patient_label}</strong> · jusqu’à {formatClock(item.expires_at)}</span><button type="button" className="button small" onClick={() => void reopen(item)} disabled={busy}>Relire la fiche</button></li>)}</ul></section>}
    {!opened && <form className="card break-glass-form" onSubmit={submit} aria-labelledby="break-glass-form-title">
      <h2 id="break-glass-form-title">Ouvrir la fiche d’urgence</h2>
      <p className="notice break-glass-warning" role="note"><strong>Ce que vous ouvrez :</strong> groupe sanguin, allergies, traitements, antécédents déclarés. Pas le carnet complet. <strong>Ce qui est tracé :</strong> votre nom, le motif et l’heure. Le patient et ses personnes de confiance sont prévenus tout de suite ; l’administrateur de votre établissement relit chaque accès sous 72 h. L’accès dure {overview.duration_minutes} min au plus et ne se renouvelle pas.</p>
      <div className="break-glass-form__grid">
        <label className="field"><span>Nom</span><input value={form.last_name} onChange={set("last_name")} autoComplete="off" required /></label>
        <label className="field"><span>Prénom</span><input value={form.first_name} onChange={set("first_name")} autoComplete="off" required /></label>
        <label className="field"><span>Date de naissance</span><input type="date" value={form.birth_date} onChange={set("birth_date")} max={new Date().toISOString().slice(0, 10)} required /></label>
        <label className="field"><span>Téléphone du patient <small>(seulement si deux homonymes)</small></span><input type="tel" inputMode="tel" value={form.phone} onChange={set("phone")} autoComplete="off" /></label>
      </div>
      <label className="field"><span>Motif de l’urgence</span>
        <select value={form.reason_category} onChange={set("reason_category")} required>
          <option value="">Choisir…</option>
          {overview.reasons.map((reason) => <option key={reason.code} value={reason.code}>{reason.label}</option>)}
        </select>
      </label>
      <label className="field"><span>Décrivez la situation <small>({form.reason_note.length}/{BREAK_GLASS_MAX_NOTE})</small></span>
        <textarea value={form.reason_note} onChange={set("reason_note")} rows={3} maxLength={BREAK_GLASS_MAX_NOTE} aria-invalid={Boolean(noteError)} aria-describedby={noteError ? "break-glass-note-error" : undefined} required />
        {noteError && <small id="break-glass-note-error" className="break-glass-form__error">{noteError}</small>}
      </label>
      <label className="break-glass-form__confirm"><input type="checkbox" checked={form.confirmed} onChange={(event) => setForm((current) => ({ ...current, confirmed: event.target.checked }))} /><span>Je confirme que ce patient ne peut pas consentir (inconscient ou danger vital) et que je réponds de cet accès devant mon établissement.</span></label>
      <div className="actions"><button className="button primary" type="submit" disabled={!complete || busy}>{busy ? "Ouverture…" : "Ouvrir la fiche d’urgence"}</button></div>
    </form>}
    {overview.items.length > 0 && <section className="card"><h2>Mes accès d’urgence</h2>
      <ul className="break-glass-list">{overview.items.map((item) => <li key={item.id}><span><strong>{item.patient_label}</strong> · {item.reason_label}<br /><small className="muted">{formatDateTime(item.requested_at)}{item.review ? ` · ${item.review.outcome_label}` : " · revue en attente"}</small></span><span className={`badge ${item.status === "active" ? "verified" : "declared"}`}>{item.status === "active" ? "Ouvert" : "Terminé"}</span></li>)}</ul></section>}
  </div>;
}
