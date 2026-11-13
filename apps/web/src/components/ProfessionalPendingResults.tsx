"use client";

import { useEffect, useState } from "react";
import { abandonPendingExam, isLabFeatureOff, listMyPending, type MyPending, type PendingForGrant } from "../application/lab-results";
import { useConfirm } from "./modal/ConfirmProvider";
import "./lab-results.css";

/* PRO-21 — côté médecin.
   - `ProfessionalPendingList` : mes consultations qui attendent des résultats (initiales du patient seulement, jamais son identité).
   - `PendingResultsPanel` : à la reprise (le patient vient de présenter un NOUVEAU QR), état des examens, PDF reçus à lire, et la sortie de
     secours « Abandonner l'examen » (motif écrit, audité) si un résultat n'arrivera pas. */

export function ProfessionalPendingList() {
  const [items, setItems] = useState<MyPending[]>([]);
  useEffect(() => {
    let active = true;
    listMyPending().then((value) => { if (active) setItems(value); }).catch((error: unknown) => { if (active && !isLabFeatureOff(error)) setItems([]); });
    return () => { active = false; };
  }, []);
  if (items.length === 0) return null;
  return <section className="card pending-banner stack" aria-labelledby="my-pending-title">
    <div className="section-heading"><div><h2 id="my-pending-title">Consultations en attente de résultats</h2></div><span className="count-badge">{items.length}</span></div>
    <ul className="stack">
      {items.map((item) => <li key={item.id}>
        <strong>{item.patient_initials || "Patient"}</strong> — {item.reason || "Consultation"} · <span className="muted">{item.status === "to_resume" ? "Résultats reçus : à reprendre" : `${item.exams_waiting} examen${item.exams_waiting > 1 ? "s" : ""} attendu${item.exams_waiting > 1 ? "s" : ""} sur ${item.exams_total}`}</span>
      </li>)}
    </ul>
    <p className="muted">Quand le patient présente un nouveau QR d’accès, la consultation se rouvre ici avec les résultats.</p>
  </section>;
}

export function PendingResultsPanel({ grantId, pending, onChanged }: { grantId: string; pending: PendingForGrant; onChanged: () => void }) {
  const confirm = useConfirm();
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function abandon(examId: string, label: string) {
    const accepted = await confirm({
      title: "Abandonner cet examen ?",
      message: `Vous renoncez au résultat de « ${label} ». Il restera noté « demandé, sans résultat » dans la consultation.`,
      note: "Le motif est enregistré dans la traçabilité. Cette action ne peut pas être annulée.",
      confirmLabel: "Abandonner l’examen",
      cancelLabel: "Garder l’attente",
    });
    if (!accepted) return;
    setBusy(true);
    setMessage("");
    try {
      await abandonPendingExam(pending.id, examId, reason.trim());
      setReasonFor(null);
      setReason("");
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Abandon impossible.");
    } finally {
      setBusy(false);
    }
  }

  const waiting = pending.status === "waiting_results";
  return <section className="card pending-banner stack" aria-labelledby="pending-panel-title">
    <h2 id="pending-panel-title">{waiting ? "Consultation en attente de résultats" : "Résultats reçus : reprenez la consultation"}</h2>
    <p className="muted">{waiting
      ? "La signature est bloquée tant que les résultats attendus ne sont pas arrivés. Si un résultat n’arrivera pas, abandonnez l’examen en indiquant le motif."
      : "Votre saisie a été reprise ci-dessous. Relisez les résultats, complétez la conclusion, puis signez."}</p>
    {!pending.documents_allowed && <p className="notice">Le patient n’a pas accordé l’accès aux documents : vous voyez l’état des examens, pas les fichiers.</p>}
    <div>
      {pending.exams.map((exam) => <div className="pending-exam" key={exam.id}>
        <div><strong>{exam.label}</strong> — <span className="muted">{exam.status_label}{exam.status === "abandoned" && exam.abandon_reason ? ` : ${exam.abandon_reason}` : ""}</span></div>
        {exam.documents.map((document) => <div key={document.id}>
          <a className="button small" href={document.download_url} target="_blank" rel="noreferrer">Lire le résultat (PDF)</a> <span className="muted">{document.issuer}{document.replaced ? " · remplacé par une version corrigée" : ""}</span>
        </div>)}
        {exam.status === "requested" && (reasonFor === exam.id
          ? <div className="stack">
            <label className="field"><span>Motif de l’abandon</span><input maxLength={240} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ex. le patient ne fera pas cet examen" /></label>
            <div className="actions"><button type="button" className="button small danger" disabled={busy || reason.trim().length < 5} onClick={() => void abandon(exam.id, exam.label)}>Abandonner l’examen</button><button type="button" className="button small" onClick={() => { setReasonFor(null); setReason(""); }}>Annuler</button></div>
          </div>
          : <div className="actions"><button type="button" className="button small" onClick={() => setReasonFor(exam.id)}>Abandonner l’examen…</button></div>)}
      </div>)}
    </div>
    {message && <p className="status" role="alert">{message}</p>}
  </section>;
}
