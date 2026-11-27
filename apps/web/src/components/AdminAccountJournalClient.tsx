"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../infrastructure/api/client";
import "./admin-console.css";

type JournalRow =
  | { id: string; kind: "deletion"; submitted_at: string }
  | { id: string; kind: "suspension"; submitted_at: string; suspension_days: number | null; reason: string; reason_label: string; suspended_until: string | null; state: "active" | "ended" | "lifted" | "legacy" };

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const when = (value: string) => dateFormat.format(new Date(value));
const STATE: Record<string, { label: string; tone: string }> = {
  active: { label: "En cours", tone: "warn" }, ended: { label: "Terminée", tone: "ok" }, lifted: { label: "Rouverte par l’équipe", tone: "ok" }, legacy: { label: "Ancienne demande", tone: "off" },
};

/* Journal en LECTURE SEULE. La suspension est immédiate quand la personne la demande, la suppression aussi (et sans motif) : l'équipe ne traite plus
   ces demandes. Pour une suspension, seul le MOTIF est montré ; pour une suppression, rien d'autre que la date. */
export function AdminAccountJournalClient() {
  const [rows, setRows] = useState<JournalRow[] | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    apiGet<JournalRow[]>("/api/v1/identity/admin/account-requests/")
      .then((data) => { if (alive) setRows(data); })
      .catch((error) => { if (alive) setMessage(error instanceof Error ? error.message : "Impossible de charger le journal."); });
    return () => { alive = false; };
  }, []);

  if (message) return <p className="notice" role="alert">{message}</p>;
  if (!rows) return <p className="muted" role="status">Chargement du journal…</p>;
  const suspensions = rows.filter((row) => row.kind === "suspension");
  const deletions = rows.filter((row) => row.kind === "deletion");
  return <div className="admin-journal">
    <p className="muted">Lecture seule : l’équipe ne gère pas ces actions. Elles prennent effet tout de suite quand la personne les demande.</p>
    <h3>Suspensions <span className="muted">({suspensions.length})</span></h3>
    {suspensions.length === 0 ? <p className="empty">Aucune suspension.</p> : <ul className="admin-loglist">
      {suspensions.map((row) => row.kind === "suspension" && <li key={row.id}>
        <div><strong>{row.reason_label || "Motif non renseigné"}</strong><small>{row.suspension_days ? `${row.suspension_days} jour(s)` : "Durée inconnue"} · demandée le {when(row.submitted_at)}{row.suspended_until ? ` · jusqu’au ${when(row.suspended_until)}` : ""}</small></div>
        <span className="badge" data-tone={STATE[row.state].tone}>{STATE[row.state].label}</span>
      </li>)}
    </ul>}
    <h3>Suppressions <span className="muted">({deletions.length})</span></h3>
    {deletions.length === 0 ? <p className="empty">Aucune suppression.</p> : <ul className="admin-loglist">
      {deletions.map((row) => <li key={row.id}><div><strong>Compte supprimé — identité effacée</strong><small>{when(row.submitted_at)} · aucun motif demandé, aucune coordonnée conservée</small></div></li>)}
    </ul>}
  </div>;
}
