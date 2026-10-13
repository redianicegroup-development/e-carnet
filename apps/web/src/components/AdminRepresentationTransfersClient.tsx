"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiGet, apiPatch } from "../infrastructure/api/client";
import { useConfirm } from "./modal/ConfirmProvider";

type Transfer = {
  id: string;
  applicant: { first_name: string; last_name: string; email: string };
  patient: { first_name: string; last_name: string; birth_date: string | null };
  created_at: string;
};

const formatDate = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export function AdminRepresentationTransfersClient() {
  const confirm = useConfirm();
  const [items, setItems] = useState<Transfer[]>([]);
  const [verified, setVerified] = useState<Record<string, { identity: boolean; age: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setItems(await apiGet<Transfer[]>("/api/v1/patient/representations/transfers/review/"));
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

  async function decide(item: Transfer, decision: "approve" | "reject") {
    const checks = verified[item.id] ?? { identity: false, age: false };
    if (decision === "approve" && (!checks.identity || !checks.age)) return;
    const accepted = await confirm({
      title: decision === "approve" ? "Transférer le dossier existant ?" : "Refuser cette demande ?",
      message: decision === "approve"
        ? `Le dossier de ${item.patient.first_name} ${item.patient.last_name} sera rattaché au compte de ${item.applicant.email}.`
        : `La demande de ${item.applicant.email} sera refusée; le dossier représenté restera inchangé.`,
      note: "Le transfert conserve le même dossier et son historique. N’approuvez qu’après contrôle de l’identité et de l’âge légal selon la procédure autorisée.",
      confirmLabel: decision === "approve" ? "Approuver le transfert" : "Refuser la demande",
      cancelLabel: "Annuler",
      mood: "decision",
      tone: decision === "approve" ? "neutral" : "danger",
    });
    if (!accepted) return;
    setBusyId(item.id);
    setMessage("");
    try {
      await apiPatch(`/api/v1/patient/representations/transfers/${item.id}/review/`, {
        decision,
        age_verified: decision === "approve" && checks.age,
        identity_verified: decision === "approve" && checks.identity,
      });
      setItems((current) => current.filter((row) => row.id !== item.id));
      setMessage(decision === "approve" ? "Transfert effectué; le dossier et son historique sont conservés." : "Demande refusée; aucune donnée du dossier n’a été modifiée.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible de traiter cette demande.");
    } finally {
      setBusyId("");
    }
  }

  return <section className="stack-lg">
    <header className="card">
      <span className="eyebrow">Autonomie du titulaire</span>
      <h2>Transferts de dossiers représentés</h2>
      <p className="muted">Vérifiez l’identité du demandeur et son âge légal par la procédure approuvée. Ne demandez pas de déposer des pièces d’identité dans cette interface. Le transfert rattache le dossier existant sans fusion ni suppression.</p>
    </header>
    {loading ? <p role="status">Chargement des demandes…</p> : items.length === 0 ? <p className="empty">Aucune demande en attente.</p> : items.map((item) => {
      const checks = verified[item.id] ?? { identity: false, age: false };
      return <article className="card stack" key={item.id}>
        <div><span className="eyebrow">Demande reçue {formatDate(item.created_at)}</span><h3>{item.patient.first_name} {item.patient.last_name}</h3><p className="muted">Date de naissance déclarée : {item.patient.birth_date ?? "non renseignée"}</p></div>
        <div><strong>Compte demandeur</strong><p>{[item.applicant.first_name, item.applicant.last_name].filter(Boolean).join(" ") || "Nom non renseigné"} · {item.applicant.email}</p></div>
        <label className="field"><span><input type="checkbox" checked={checks.identity} onChange={(event) => setVerified((current) => ({ ...current, [item.id]: { ...checks, identity: event.target.checked } }))} disabled={busyId === item.id} /> Je confirme avoir vérifié l’identité du demandeur.</span></label>
        <label className="field"><span><input type="checkbox" checked={checks.age} onChange={(event) => setVerified((current) => ({ ...current, [item.id]: { ...checks, age: event.target.checked } }))} disabled={busyId === item.id} /> Je confirme avoir vérifié qu’il a atteint l’âge légal configuré.</span></label>
        <div className="actions"><button type="button" className="button primary" onClick={() => void decide(item, "approve")} disabled={busyId === item.id || !checks.identity || !checks.age}>{busyId === item.id ? "Traitement…" : "Approuver le transfert"}</button><button type="button" className="button" onClick={() => void decide(item, "reject")} disabled={busyId === item.id}>Refuser</button></div>
      </article>;
    })}
    <p className="status" role="status" aria-live="polite">{message}</p>
  </section>;
}
