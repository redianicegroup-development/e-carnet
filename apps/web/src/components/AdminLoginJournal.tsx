"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../infrastructure/api/client";
import "./admin-console.css";

type LoginEvent = { id: string; outcome: "success" | "failure" | "blocked"; method: "password" | "oauth"; created_at: string; user: { id: number; name: string; email: string } | null };
type Payload = { summary_24h: Record<"success" | "failure" | "blocked", number>; items: LoginEvent[] };

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const OUTCOME = { success: { label: "Réussie", tone: "ok" }, failure: { label: "Échec", tone: "warn" }, blocked: { label: "Compte fermé", tone: "off" } } as const;
const METHOD = { password: "Mot de passe", oauth: "Compte Google, Facebook ou Apple" } as const;

/* Journal des connexions : qui, résultat, moyen, heure. Ni adresse IP, ni appareil. Conservé 90 jours. */
export function AdminLoginJournal() {
  const [outcome, setOutcome] = useState("");
  const [data, setData] = useState<Payload | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await apiGet<Payload>(`/api/v1/identity/admin/login-events/${outcome ? `?outcome=${outcome}` : ""}`));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible de charger le journal.");
    }
  }, [outcome]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return <div className="admin-journal">
    <p className="muted">100 derniers événements · conservés 90 jours · sans adresse IP ni appareil.</p>
    {data && <div className="admin-chips" role="group" aria-label="Filtrer par résultat">
      {([["", "Tout", data.summary_24h.success + data.summary_24h.failure + data.summary_24h.blocked], ["success", "Réussies 24 h", data.summary_24h.success], ["failure", "Échecs 24 h", data.summary_24h.failure], ["blocked", "Comptes fermés 24 h", data.summary_24h.blocked]] as const).map(([value, label, count]) =>
        <button key={label} type="button" className="admin-chip" data-active={outcome === value ? "true" : undefined} aria-pressed={outcome === value} onClick={() => setOutcome(value)}><strong>{count}</strong><span>{label}</span></button>)}
    </div>}
    {message && <p className="notice" role="alert">{message}</p>}
    {!data && !message && <p className="muted" role="status">Chargement du journal…</p>}
    {data && data.items.length === 0 && <p className="empty">Aucune connexion enregistrée.</p>}
    {data && data.items.length > 0 && <ul className="admin-loglist">
      {data.items.map((event) => <li key={event.id}>
        <div><strong>{event.user ? event.user.name : "Adresse inconnue"}</strong><small>{event.user?.email ? `${event.user.email} · ` : ""}{METHOD[event.method]} · {dateFormat.format(new Date(event.created_at))}</small></div>
        <span className="badge" data-tone={OUTCOME[event.outcome].tone}>{OUTCOME[event.outcome].label}</span>
      </li>)}
    </ul>}
  </div>;
}
