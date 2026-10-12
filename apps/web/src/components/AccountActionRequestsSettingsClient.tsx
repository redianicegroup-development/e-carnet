"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "../infrastructure/api/client";

type RequestType = "suspension" | "deletion";
type RequestStatus = "new" | "in_review" | "resolved" | "rejected";
type AccountActionRequest = {
  id: string;
  request_type: RequestType;
  suspension_days: number | null;
  reason: string;
  details: string;
  status: RequestStatus;
  submitted_at: string;
  reviewed_at: string | null;
};

const statusLabels: Record<RequestStatus, string> = {
  new: "Nouvelle — en attente",
  in_review: "En cours d’examen",
  resolved: "Traitée",
  rejected: "Refusée",
};
const reasonLabels: Record<string, string> = {
  not_needed: "Je n’ai plus besoin du compte",
  duplicate: "J’ai un autre compte",
  privacy: "Motif lié à la confidentialité",
  experience: "Mon expérience ne correspond pas à mes besoins",
  other: "Autre motif",
};
const formatDate = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export function AccountActionRequestsSettingsClient() {
  const [requests, setRequests] = useState<AccountActionRequest[]>([]);
  const [days, setDays] = useState("30");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadRequests = useCallback(async () => {
    try {
      setRequests(await apiGet<AccountActionRequest[]>("/api/v1/identity/me/account-requests/"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible de charger vos demandes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadRequests(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRequests]);

  async function submit(event: FormEvent<HTMLFormElement>, requestType: RequestType) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const payload = requestType === "suspension"
        ? { request_type: requestType, suspension_days: Number(days) }
        : { request_type: requestType, reason, details: reason === "other" ? details.trim() : "" };
      const created = await apiPost<AccountActionRequest>("/api/v1/identity/me/account-requests/", payload);
      setRequests((current) => [created, ...current]);
      setReason("");
      setDetails("");
      setMessage("Votre demande a été transmise à l’administration. Vous pouvez suivre son statut ci-dessous.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "La demande n’a pas pu être envoyée.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="settings-modal-section">
    <span className="eyebrow">Demandes de gestion du compte</span>
    <p className="muted">Ces formulaires transmettent une demande à l’administration. La suspension ou la suppression n’est pas exécutée automatiquement : l’équipe examine la demande avant toute action.</p>

    <section className="card settings-subsection">
      <div><h3>Demander une suspension temporaire</h3><p className="muted">Choisissez la durée souhaitée. L’équipe vous confirmera le traitement de la demande.</p></div>
      <form className="settings-form" onSubmit={(event) => void submit(event, "suspension")}>
        <label className="field"><span>Durée souhaitée</span><select value={days} onChange={(event) => setDays(event.target.value)} disabled={busy}><option value="1">1 jour</option><option value="7">7 jours</option><option value="14">14 jours</option><option value="30">30 jours</option><option value="60">60 jours</option><option value="90">90 jours</option></select></label>
        <button className="button secondary" type="submit" disabled={busy}>{busy ? "Envoi…" : "Envoyer la demande de suspension"}</button>
      </form>
    </section>

    <section className="card settings-subsection">
      <div><h3>Demander la suppression du compte</h3><p className="muted">La demande est d’abord examinée par l’administration. Aucun compte ni dossier n’est supprimé lors de l’envoi de ce formulaire.</p></div>
      <form className="settings-form" onSubmit={(event) => void submit(event, "deletion")}>
        <label className="field"><span>Motif</span><select value={reason} onChange={(event) => setReason(event.target.value)} required disabled={busy}><option value="" disabled>Choisissez un motif</option><option value="not_needed">Je n’ai plus besoin du compte</option><option value="duplicate">J’ai un autre compte</option><option value="privacy">Motif lié à la confidentialité</option><option value="experience">Mon expérience ne correspond pas à mes besoins</option><option value="other">Autre motif</option></select></label>
        {reason === "other" && <label className="field"><span>Précisez votre motif</span><textarea value={details} onChange={(event) => setDetails(event.target.value)} required maxLength={1200} rows={4} disabled={busy} placeholder="Décrivez brièvement le motif de votre demande." /></label>}
        <button className="button danger" type="submit" disabled={busy || !reason || (reason === "other" && !details.trim())}>{busy ? "Envoi…" : "Envoyer la demande de suppression"}</button>
      </form>
    </section>

    {message && <p className="notice" role="status" aria-live="polite">{message}</p>}
    <section className="settings-subsection" aria-labelledby="account-request-history-title">
      <h3 id="account-request-history-title">Mes demandes</h3>
      {loading ? <p className="muted">Chargement…</p> : requests.length === 0 ? <p className="muted">Aucune demande envoyée.</p> : <div className="settings-provider-list">{requests.map((item) => <article className="card settings-subsection" key={item.id}>
        <div className="admin-feedback-head"><strong>{item.request_type === "suspension" ? `Suspension · ${item.suspension_days} jour(s)` : "Suppression du compte"}</strong><span className="badge">{statusLabels[item.status]}</span></div>
        {item.request_type === "deletion" && <p className="muted">Motif : {reasonLabels[item.reason] ?? item.reason}{item.details ? ` — ${item.details}` : ""}</p>}
        <small className="muted">Envoyée le {formatDate(item.submitted_at)}{item.reviewed_at ? ` · examinée le ${formatDate(item.reviewed_at)}` : ""}</small>
      </article>)}</div>}
    </section>
  </div>;
}
