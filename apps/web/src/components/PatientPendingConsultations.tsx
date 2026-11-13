"use client";

import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ApiError } from "../infrastructure/api/client";
import { cancelPending, getExamQr, isLabFeatureOff, listPatientPending, renewExamQr, revokeExamQr, type PatientPending } from "../application/lab-results";
import { useConfirm } from "./modal/ConfirmProvider";
import { Icon } from "./ui/Icon";
import "./lab-results.css";

/* PRO-21 — « Mes examens en attente ». Le médecin a demandé un examen et attend le résultat avant de signer sa consultation.
   Le patient montre son QR d'examen au laboratoire (il l'affiche ou le masque à volonté), le laboratoire dépose le PDF, puis le patient
   présente un NOUVEAU QR d'accès à son médecin pour qu'il reprenne la consultation. Rien ne s'affiche si la fonction est éteinte ou s'il n'y a rien en attente. */

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

function ExamQr({ pending, onChanged }: { pending: PatientPending; onChanged: () => void }) {
  const confirm = useConfirm();
  const [token, setToken] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function show() {
    setBusy(true);
    setMessage("");
    try {
      // QR retiré ou périmé (404) : on en génère un nouveau plutôt que d'afficher une erreur.
      const qr = await getExamQr(pending.id).catch((error: unknown) => (error instanceof ApiError && error.status === 404 ? renewExamQr(pending.id) : Promise.reject(error)));
      setToken(qr.token);
      setShown(true);
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "QR indisponible.");
    } finally {
      setBusy(false);
    }
  }

  async function renew() {
    setBusy(true);
    setMessage("");
    try {
      setToken((await renewExamQr(pending.id)).token);
      setShown(true);
      setMessage("Nouveau QR généré : l’ancien ne fonctionne plus.");
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible de renouveler le QR.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    const accepted = await confirm({ title: "Retirer ce QR ?", message: "Plus aucun laboratoire ne pourra l’utiliser. Vous pourrez en générer un nouveau à tout moment.", confirmLabel: "Retirer le QR" });
    if (!accepted) return;
    setBusy(true);
    try {
      await revokeExamQr(pending.id);
      setToken(null);
      setShown(false);
      setMessage("QR retiré.");
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible de retirer le QR.");
    } finally {
      setBusy(false);
    }
  }

  if (pending.status !== "waiting_results" && pending.status !== "to_resume") return null;
  return <div className="stack">
    {shown && token
      ? <div className="qr-exam" role="group" aria-label="QR d’examen à montrer au laboratoire">
        <QRCodeSVG value={token} size={200} includeMargin aria-label="QR d’examen" />
        <p className="muted">Montrez-le au laboratoire. Valable jusqu’au {dateLabel(pending.qr_expires_at)}. Il ne donne accès à rien d’autre qu’à cette demande d’examen.</p>
        <div className="actions"><button type="button" className="button small" onClick={() => setShown(false)}>Masquer le QR</button><button type="button" className="button small" disabled={busy} onClick={() => void renew()}>Nouveau QR</button><button type="button" className="button small danger" disabled={busy} onClick={() => void revoke()}>Retirer le QR</button></div>
      </div>
      : <div className="actions"><button type="button" className="button dark" disabled={busy} onClick={() => void show()}><Icon name="qr" size={18} /> Afficher mon QR d’examen</button></div>}
    {message && <p className="status" role="status" aria-live="polite">{message}</p>}
  </div>;
}

export function PatientPendingConsultations() {
  const confirm = useConfirm();
  const [items, setItems] = useState<PatientPending[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setItems(await listPatientPending());
      setError("");
    } catch (reason) {
      if (isLabFeatureOff(reason)) setItems([]);
      else setError(reason instanceof Error ? reason.message : "Examens en attente indisponibles.");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function cancel(item: PatientPending) {
    const accepted = await confirm({
      title: "Annuler l’attente ?",
      message: `${item.professional_name} n’attendra plus ces résultats et la consultation ne pourra pas être reprise telle quelle. Le QR d’examen sera retiré.`,
      note: "À faire seulement si vous ne ferez pas l’examen, ou si vous voulez consulter quelqu’un d’autre.",
      confirmLabel: "Annuler l’attente",
      cancelLabel: "Garder",
    });
    if (!accepted) return;
    try { await cancelPending(item.id); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Annulation impossible."); }
  }

  if (error) return <p className="notice" role="alert">{error}</p>;
  if (!items || items.length === 0) return null;
  return <section className="card stack" aria-labelledby="pending-exams-title">
    <div className="section-heading"><div><h2 id="pending-exams-title">Mes examens en attente</h2></div><span className="count-badge">{items.length}</span></div>
    {items.map((item) => <article className="record stack" key={item.id}>
      <div>
        <strong>{item.professional_name || "Votre médecin"}</strong> · {item.facility_label}
        <p className="muted">{item.reason || "Consultation"} — demandée le {dateLabel(item.created_at)}</p>
        <span className="badge pending">{item.status === "to_resume" ? "Résultats reçus : à reprendre avec votre médecin" : "En attente des résultats"}</span>
      </div>
      <ul className="stack" aria-label="Examens demandés">
        {item.exams.map((exam) => <li key={exam.id}>
          <strong>{exam.label}</strong> — <span className="muted">{exam.status_label}{exam.status === "abandoned" && exam.abandon_reason ? ` (${exam.abandon_reason})` : ""}</span>
          {exam.documents.filter((document) => !document.replaced).map((document) => <div key={document.id}><a className="button small" href={`/api/v1/patient/care/documents/${document.id}/download/`} target="_blank" rel="noreferrer">Lire le résultat (PDF)</a> <span className="muted">{document.issuer} · {dateLabel(document.created_at)}</span></div>)}
        </li>)}
      </ul>
      {item.status === "waiting_results" && <ExamQr pending={item} onChanged={() => void load()} />}
      {item.status === "to_resume" && <p className="notice">Montrez votre QR d’accès (« Partager en QR ») à votre médecin : il reprendra votre consultation avec les résultats.</p>}
      <div className="actions"><button type="button" className="button small danger" onClick={() => void cancel(item)}>Annuler l’attente</button></div>
    </article>)}
  </section>;
}
