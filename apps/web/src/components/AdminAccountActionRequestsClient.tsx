"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiGet, apiPatch } from "../infrastructure/api/client";

type RequestStatus = "new" | "in_review" | "resolved" | "rejected";
type AccountRequest = {
  id: string;
  request_type: "suspension" | "deletion";
  suspension_days: number | null;
  reason: string;
  details: string;
  status: RequestStatus;
  submitted_at: string;
  reviewed_at: string | null;
  user_email: string;
  user_first_name: string;
  user_last_name: string;
  reviewed_by_email: string | null;
};

const statuses: { value: RequestStatus; label: string }[] = [
  { value: "new", label: "Nouvelle" },
  { value: "in_review", label: "En cours d’examen" },
  { value: "resolved", label: "Traitée" },
  { value: "rejected", label: "Refusée" },
];
const reasonLabels: Record<string, string> = {
  not_needed: "Je n’ai plus besoin du compte",
  duplicate: "J’ai un autre compte",
  privacy: "Motif lié à la confidentialité",
  experience: "Mon expérience ne correspond pas à mes besoins",
  other: "Autre motif",
};
const formatDate = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export function AdminAccountActionRequestsClient() {
  const [items, setItems] = useState<AccountRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setItems(await apiGet<AccountRequest[]>("/api/v1/identity/admin/account-requests/"));
      setMessage("");
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) setMessage("Accès réservé aux superadministrateurs.");
      else setMessage(error instanceof Error ? error.message : "Impossible de charger les demandes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function changeStatus(item: AccountRequest, status: RequestStatus) {
    setBusyId(item.id);
    setMessage("");
    try {
      const updated = await apiPatch<AccountRequest>(`/api/v1/identity/admin/account-requests/${item.id}/`, { status });
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, ...updated } : row));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible de mettre à jour le statut.");
    } finally {
      setBusyId("");
    }
  }

  if (loading) return <section className="card"><p className="muted">Chargement des demandes…</p></section>;
  return <section className="stack-lg">
    <div className="card admin-table-card"><div className="admin-table-title"><div><span className="eyebrow">Demandes privées</span><h2>Suspensions et suppressions de compte</h2></div><span className="muted">{items.length} demande(s) · maximum 250 chargées</span></div>
      <p className="admin-privacy-note">Ces demandes ne modifient pas automatiquement les comptes. Examinez-les puis mettez à jour leur statut après traitement.</p>
      {message && <p className="notice" role="alert">{message}</p>}
      {items.length === 0 ? <p className="empty">Aucune demande de gestion de compte.</p> : <div className="admin-feedback-list">{items.map((item) => <article className="admin-feedback-item" key={item.id}>
        <div className="admin-feedback-head"><div><span className="badge">{item.request_type === "suspension" ? `Suspension · ${item.suspension_days} jour(s)` : "Suppression du compte"}</span><span className="badge">{item.request_type === "deletion" ? reasonLabels[item.reason] ?? item.reason : "Durée demandée"}</span></div><small>{formatDate(item.submitted_at)}</small></div>
        <p><strong>{[item.user_first_name, item.user_last_name].filter(Boolean).join(" ") || "Compte utilisateur"}</strong><br /><a href={`mailto:${item.user_email}`}>{item.user_email}</a></p>
        {item.details && <div><strong>Précision du motif</strong><p className="admin-feedback-message">{item.details}</p></div>}
        <div className="admin-feedback-head"><small>{item.reviewed_at ? `Dernière revue : ${formatDate(item.reviewed_at)}${item.reviewed_by_email ? ` par ${item.reviewed_by_email}` : ""}` : "Pas encore examinée"}</small><label className="field admin-feedback-select"><span>Statut</span><select aria-label={`Statut de la demande de ${item.user_email}`} value={item.status} disabled={busyId === item.id} onChange={(event) => void changeStatus(item, event.target.value as RequestStatus)}>{statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label></div>
      </article>)}</div>}
    </div>
  </section>;
}
