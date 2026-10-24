"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiGet, apiPatch } from "../infrastructure/api/client";
import "./admin-recovery.css";

type RecoveryEvent = { id: string; event_type: string; label: string; email: string; name: string; failures: number | null; created_at: string };
type LockedAccount = { email: string; name: string; failures: number; locked_until: string };
type HelpRequest = { id: string; name: string; contact_kind: "email" | "phone"; contact_value: string; message: string; status: "new" | "in_progress" | "resolved"; submitted_at: string };
type RecoveryData = {
  generated_at: string;
  summary: { failed_24h: number; blocked_24h: number; locked_now: number; verified_24h: number; resets_24h: number; help_open: number };
  events: RecoveryEvent[];
  locked_accounts: LockedAccount[];
  help_requests: HelpRequest[];
};

const STATUS: { value: HelpRequest["status"]; label: string }[] = [
  { value: "new", label: "Nouvelle" },
  { value: "in_progress", label: "En cours" },
  { value: "resolved", label: "Traitée" },
];
/** Gravité visuelle d'un événement : de l'information (acceptée, réinitialisée) à l'alerte (blocage). */
const TONE: Record<string, string> = {
  "account.recovery_answer_failed": "warn",
  "account.recovery_attempt_blocked": "warn",
  "account.recovery_locked": "danger",
  "account.recovery_answer_verified": "ok",
  "account.password_reset_by_recovery": "ok",
  "account.recovery_method_configured": "info",
};
const formatDate = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

/** Récupérations de compte : ce qui s'est passé (réponses fausses, blocages, réponses acceptées, réinitialisations),
    les comptes bloqués maintenant, et les demandes « Écrire à l'équipe » des personnes qui ne se souviennent plus de leur réponse. */
export function AdminRecoveryClient() {
  const [data, setData] = useState<RecoveryData | null>(null);
  const [message, setMessage] = useState("Chargement…");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(() => apiGet<RecoveryData>("/api/v1/identity/admin/recovery/"), []);
  const refresh = useCallback(async () => {
    try {
      setData(await load());
      setMessage("");
    } catch (error) {
      setMessage(error instanceof ApiError && error.status === 403 ? "Accès réservé aux administrateurs autorisés." : "Impossible de charger les récupérations de compte.");
    }
  }, [load]);
  useEffect(() => {
    let cancelled = false;
    void load().then((result) => {
      if (cancelled) return;
      setData(result);
      setMessage("");
    }).catch((error: unknown) => {
      if (cancelled) return;
      setMessage(error instanceof ApiError && error.status === 403 ? "Accès réservé aux administrateurs autorisés." : "Impossible de charger les récupérations de compte.");
    });
    return () => { cancelled = true; };
  }, [load]);

  async function setStatus(item: HelpRequest, status: HelpRequest["status"]) {
    setBusyId(item.id);
    try {
      await apiPatch(`/api/v1/identity/admin/contact-messages/${item.id}/`, { status });
      setData((current) => current ? { ...current, help_requests: current.help_requests.map((entry) => entry.id === item.id ? { ...entry, status } : entry), summary: { ...current.summary, help_open: current.help_requests.filter((entry) => (entry.id === item.id ? status : entry.status) !== "resolved").length } } : current);
    } catch {
      setMessage("Le statut n’a pas pu être enregistré.");
    } finally {
      setBusyId("");
    }
  }

  if (!data) return <section className="card admin-recovery"><p className="status" role="status">{message}</p></section>;
  const { summary } = data;
  const cards: { label: string; value: number; tone: string }[] = [
    { label: "Réponses fausses (24 h)", value: summary.failed_24h, tone: summary.failed_24h ? "warn" : "" },
    { label: "Comptes bloqués maintenant", value: summary.locked_now, tone: summary.locked_now ? "danger" : "" },
    { label: "Tentatives bloquées (24 h)", value: summary.blocked_24h, tone: summary.blocked_24h ? "warn" : "" },
    { label: "Réponses acceptées (24 h)", value: summary.verified_24h, tone: "" },
    { label: "Mots de passe réinitialisés (24 h)", value: summary.resets_24h, tone: "" },
    { label: "Demandes d’aide à traiter", value: summary.help_open, tone: summary.help_open ? "warn" : "" },
  ];

  return <div className="stack-lg admin-recovery">
    <section className="card">
      <div className="admin-recovery__head"><div><span className="eyebrow">Sécurité des comptes</span><h2>Récupérations de compte</h2><p className="muted">Chaque tentative sur un compte réel laisse une trace datée. Les réponses secrètes et les mots de passe ne sont jamais affichés. Les adresses sans compte ne sont pas journalisées.</p></div>      <button type="button" className="button" onClick={() => void refresh()}>Actualiser</button></div>
      <div className="admin-recovery__cards">{cards.map((card) => <div key={card.label} className={`admin-recovery__card${card.tone ? ` is-${card.tone}` : ""}`}><strong>{card.value}</strong><span>{card.label}</span></div>)}</div>
      {message && <p className="status" role="status">{message}</p>}
    </section>

    <section className="card" aria-labelledby="recovery-locked">
      <h3 id="recovery-locked">Comptes bloqués maintenant</h3>
      {data.locked_accounts.length === 0 ? <p className="empty">Aucun compte bloqué.</p> : <div className="admin-recovery__list">{data.locked_accounts.map((account) => <article key={account.email} className="record"><div><strong>{account.name || account.email}</strong><p className="muted">{account.email}</p><p className="muted">{account.failures} réponses fausses · bloqué jusqu’au {formatDate(account.locked_until)}</p></div><span className="badge refused">Bloqué</span></article>)}</div>}
    </section>

    <section className="card" aria-labelledby="recovery-help">
      <h3 id="recovery-help">Demandes « Écrire à l’équipe »</h3>
      <p className="muted">Personnes qui ne se souviennent plus de leur réponse. Vérifiez leur identité avant tout accès.</p>
      {data.help_requests.length === 0 ? <p className="empty">Aucune demande.</p> : <div className="admin-recovery__list">{data.help_requests.map((item) => <article key={item.id} className="record admin-recovery__help">
        <div><strong>{item.name}</strong><p className="muted">{item.contact_kind === "email" ? "E-mail" : "Téléphone"} : {item.contact_value} · {formatDate(item.submitted_at)}</p><p>{item.message}</p></div>
        <label className="field"><span>Statut</span><select value={item.status} disabled={busyId === item.id} onChange={(event) => void setStatus(item, event.target.value as HelpRequest["status"])}>{STATUS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      </article>)}</div>}
    </section>

    <section className="card" aria-labelledby="recovery-journal">
      <h3 id="recovery-journal">Journal des récupérations</h3>
      {data.events.length === 0 ? <p className="empty">Aucune tentative enregistrée pour le moment.</p> : <div className="admin-recovery__list">{data.events.map((event) => <article key={event.id} className="record admin-recovery__event">
        <div><strong>{event.label}</strong><p className="muted">{event.name ? `${event.name} · ` : ""}{event.email || "Compte supprimé"}{event.failures ? ` · échec n° ${event.failures}` : ""}</p></div>
        <div className="admin-recovery__when"><span className={`admin-recovery__dot is-${TONE[event.event_type] ?? "info"}`} aria-hidden="true" /><time dateTime={event.created_at}>{formatDate(event.created_at)}</time></div>
      </article>)}</div>}
    </section>
  </div>;
}
