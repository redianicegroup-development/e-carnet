"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { depositResult, isLabFeatureOff, listLabHistory, resolveExamQr, type LabResolved } from "../application/lab-results";
import { localDay } from "../lib/lab-history";
import { cleanScannedToken } from "../lib/qr-scan";
import { QrScanner } from "./QrScanner";
import { Icon } from "./ui/Icon";
import { PageHeader } from "./ui/PageHeader";
import { useLaboratoryName } from "./useLaboratoryName";
import "./lab-results.css";

/* PRO-21 — onglet « Scanner » de l'espace laboratoire. Le laboratoire ne lit aucun dossier : il scanne le QR d'examen du patient,
   reconnaît la personne (nom + date de naissance), confirme son identité, puis dépose un PDF par examen. Il n'a ni recherche de patient,
   ni historique médical ; ses dépôts passés sont dans l'onglet « Dépôts ». */

const EXAM_KIND: Record<string, string> = { analysis: "Analyse", imaging: "Imagerie", other: "Autre examen" };

function birthLabel(value: string | null) {
  if (!value) return "date de naissance non renseignée";
  return `né(e) le ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value}T00:00:00`))}`;
}

function ExamRow({ exam, token, confirmed, onDone }: { exam: LabResolved["exams"][number]; token: string; confirmed: boolean; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const received = exam.status === "result_received";
  const abandoned = exam.status === "abandoned";

  async function send() {
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      await depositResult({ token, examId: exam.id, file, identityConfirmed: confirmed });
      setFile(null);
      setMessage(received ? "Version corrigée déposée : l’ancienne est conservée, marquée « remplacée »." : "Résultat déposé dans le carnet du patient.");
      onDone();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Dépôt impossible.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="lab-exam-row">
    <div><strong>{exam.label}</strong> <span className="muted">· {EXAM_KIND[exam.kind] ?? exam.kind}</span> {received && <span className="badge">Résultat déposé</span>} {abandoned && <span className="badge">Abandonné par le médecin</span>}</div>
    {!abandoned && <>
      <label className="field"><span>{received ? "Déposer une version corrigée (PDF)" : "Résultat au format PDF"}</span><input type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
      <div className="actions"><button type="button" className="button small primary" disabled={busy || !file || !confirmed} onClick={() => void send()}>{busy ? "Dépôt…" : received ? "Remplacer le résultat" : "Déposer le résultat"}</button></div>
      {!confirmed && <p className="muted">Confirmez d’abord l’identité de la personne.</p>}
    </>}
    {message && <p className="status" role="status" aria-live="polite">{message}</p>}
  </div>;
}

export function LaboratoryScanner() {
  const name = useLaboratoryName();
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
  const [token, setToken] = useState("");
  const [resolved, setResolved] = useState<LabResolved | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [today, setToday] = useState<number | null>(null);
  const [off, setOff] = useState(false);

  // Dépôts du jour : sert aussi de sonde (fonction éteinte côté serveur = 404 = on n'affiche que l'avis).
  const loadToday = useCallback(() => {
    const day = localDay(new Date());
    listLabHistory({ from: day, to: day }).then((data) => setToday(data.counts.deposited + data.counts.replaced)).catch((error: unknown) => { if (isLabFeatureOff(error)) setOff(true); });
  }, []);
  useEffect(() => { loadToday(); }, [loadToday]);

  async function resolve(raw: string) {
    const clean = cleanScannedToken(raw);
    if (!clean) return;
    setScanning(false);
    setBusy(true);
    setMessage("");
    try {
      setResolved(await resolveExamQr(clean));
      setToken(clean);
      setConfirmed(false);
      setManual("");
    } catch (error) {
      setResolved(null);
      setToken("");
      setMessage(error instanceof Error ? error.message : "QR illisible.");
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    if (token) setResolved(await resolveExamQr(token).catch(() => null));
    loadToday();
  }

  if (off) return <section className="notice" role="status"><strong>Espace laboratoire non activé.</strong> Cette fonction n’est pas encore ouverte pour votre structure.</section>;

  return <div className="stack-lg">
    <PageHeader eyebrow={name} title="Résultats d’examens" lead="Scannez le QR d’examen du patient, vérifiez son identité, puis déposez le résultat en PDF." />
    <section className="card stack" aria-labelledby="lab-scan-title">
      <h2 id="lab-scan-title">1. Scanner le QR d’examen</h2>
      {scanning
        ? <QrScanner onResult={(value) => void resolve(value)} onClose={() => setScanning(false)} />
        : <div className="actions"><button type="button" className="button dark" onClick={() => setScanning(true)}><Icon name="qr" size={18} /> Scanner le QR</button></div>}
      <form className="stack" onSubmit={(event) => { event.preventDefault(); void resolve(manual); }}>
        <label className="field"><span>Ou saisir le code du QR</span><input value={manual} onChange={(event) => setManual(event.target.value)} autoComplete="off" spellCheck={false} placeholder="EXQ1…" /></label>
        <div className="actions"><button type="submit" className="button small" disabled={busy || !manual.trim()}>Lire le code</button></div>
      </form>
      {message && <p className="status" role="alert">{message}</p>}
    </section>

    {resolved && <section className="card stack" aria-labelledby="lab-identity-title">
      <h2 id="lab-identity-title">2. Vérifier la personne</h2>
      <div className="lab-identity"><strong>{resolved.patient.first_name} {resolved.patient.last_name.toLocaleUpperCase("fr-FR")}</strong><span>{birthLabel(resolved.patient.birth_date)}</span></div>
      <label className="check"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> <span>Je confirme que la personne présente correspond à ce nom et à cette date de naissance.</span></label>
      <h2>3. Déposer les résultats</h2>
      {resolved.exams.map((exam) => <ExamRow key={exam.id} exam={exam} token={token} confirmed={confirmed} onDone={() => void refresh()} />)}
    </section>}

    <section className="card stack" aria-labelledby="lab-today-title">
      <h2 id="lab-today-title">Aujourd’hui</h2>
      <p>{today === null ? "Chargement…" : today === 0 ? "Aucun dépôt pour le moment." : `${today} dépôt${today > 1 ? "s" : ""} aujourd’hui.`}</p>
      <div className="actions"><Link className="button small" href="/laboratoire/depots">Voir tous mes dépôts</Link></div>
      <p className="muted">Le contenu des résultats n’est jamais relu par le laboratoire.</p>
    </section>
  </div>;
}
