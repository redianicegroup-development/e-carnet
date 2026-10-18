"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { ApiError } from "../infrastructure/api/client";
import { listProfessionalGrants, ProfessionalGrant, requestProfessionalGrant } from "../application/professional-access-grants";

const MOCK_GRANTS: ProfessionalGrant[] = [];
const SCOPE_LABELS: Record<string, string> = { preconsultation: "Pré-consultation", declarations: "Déclarations", consultations: "Consultations", documents: "Documents médicaux (lecture seule)" };

export function ProfessionalAccessGrants() {
  const [items, setItems] = useState<ProfessionalGrant[]>(MOCK_GRANTS);
  const [qrToken, setQrToken] = useState("");
  const [includeDocuments, setIncludeDocuments] = useState(false);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<IScannerControls | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("Chargement de vos demandes…");

  useEffect(() => {
    let active = true;
    listProfessionalGrants().then((loaded) => {
      if (active) { setItems(loaded); setMessage("Demandes chargées."); }
    }).catch((error: unknown) => {
      if (active) setMessage(error instanceof ApiError && error.status === 403 ? "Connectez-vous avec un profil professionnel autorisé." : "Impossible de charger les demandes. Réessayez.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!qrToken.trim()) { setMessage("Scannez le QR du patient ou collez son jeton temporaire pour continuer."); return; }
    setSubmitting(true);
    try {
      const scopes = includeDocuments ? ["preconsultation", "declarations", "documents"] : ["preconsultation", "declarations"];
      const created = await requestProfessionalGrant(scopes, qrToken.trim());
      setItems((current) => [created, ...current]);
      setQrToken("");
      setMessage("Demande envoyée. Le patient doit l’autoriser avant tout accès.");
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "Demande refusée.");
    } finally {
      setSubmitting(false);
    }
  }

  async function startScanner() {
    if (!videoRef.current) return;
    setScanning(true);
    const reader = new BrowserMultiFormatReader();
    try {
      scannerRef.current = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
        if (!result) return;
        setQrToken(result.getText());
        setScanning(false);
        scannerRef.current?.stop();
        scannerRef.current = null;
        setMessage("QR lu : le jeton identifie le carnet. Vérifiez le patient avec lui avant d’envoyer la demande.");
      });
    } catch {
      setScanning(false);
      setMessage("Caméra indisponible. Collez le jeton QR reçu par le patient.");
    }
  }

  function stopScanner() {
    scannerRef.current?.stop();
    scannerRef.current = null;
    setScanning(false);
  }

  return <div className="stack-lg">
    <section className="hero-page"><span className="eyebrow">Accès contrôlé</span><h1>Demander l’accès, sans contourner le patient.</h1><p className="muted">Votre vérification, votre rattachement et votre établissement actif sont contrôlés par l’API. Une demande ne donne aucun accès avant le consentement du patient.</p><p className="notice" role="status" aria-live="polite">{message}</p></section>
    <section className="patient-grid" aria-label="Demandes d’accès">
      <form id="nouvelle-demande" className="card" onSubmit={submit}><span className="eyebrow">Nouvelle demande</span><h2>Présenter un patient</h2><p className="muted">Scannez le QR temporaire présenté par le patient ou collez son jeton. Le jeton identifie directement le carnet; il expire après 5 minutes et ne peut être utilisé qu’une fois.</p><label className="field"><span>QR temporaire du patient</span><input required value={qrToken} onChange={(event) => setQrToken(event.target.value)} placeholder="Scannez ou collez le jeton" autoComplete="off" /></label><div className="actions"><button type="button" className="button" onClick={() => void startScanner()} disabled={scanning}>{scanning ? "Caméra active…" : "Scanner avec la caméra"}</button>{scanning && <button type="button" className="button" onClick={stopScanner}>Arrêter</button>}</div>{scanning && <video ref={videoRef} className="qr-video" muted playsInline aria-label="Caméra de lecture du QR" />}<label className="field"><span><input type="checkbox" checked={includeDocuments} onChange={(event) => setIncludeDocuments(event.target.checked)} /> Demander aussi l’accès en lecture seule aux documents</span></label><p className="muted">Périmètre proposé : pré-consultation et déclarations. Les documents sont séparés et ne sont demandés que si vous cochez cette option. Aucun accès n’est ouvert avant la décision du patient.</p><button className="button primary" type="submit" disabled={submitting || !qrToken.trim()}>{submitting ? "Envoi…" : "Envoyer la demande"}</button></form>
      <section id="historique" className="card"><span className="eyebrow">Historique</span><h2>Mes demandes</h2>{loading ? <p className="empty" role="status">Chargement…</p> : items.length === 0 ? <p className="empty">Aucune demande envoyée depuis cet établissement.</p> : <div className="stack">{items.map((item) => <article className="record" key={item.id}><div><strong>{item.professional_name}</strong><p className="muted">{item.facility_label} · {item.scope.map((scope) => SCOPE_LABELS[scope] ?? scope).join(", ")}</p></div><span className={`badge ${item.status === "active" ? "verified" : "declared"}`}>{item.status}</span></article>)}</div>}</section>
    </section>
  </div>;
}
