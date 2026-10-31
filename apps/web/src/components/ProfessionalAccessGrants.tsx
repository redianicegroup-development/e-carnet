"use client";

import { useEffect, useState } from "react";
import { ApiError } from "../infrastructure/api/client";
import { listProfessionalGrants, ProfessionalGrant, requestProfessionalGrant } from "../application/professional-access-grants";
import { QrScanner } from "./QrScanner";

const MOCK_GRANTS: ProfessionalGrant[] = [];
const STATUS_LABELS: Record<string, string> = { pending: "En attente du patient", active: "Autorisé", refused: "Refusé", expired: "Expiré", revoked: "Révoqué" };
const SCOPE_LABELS: Record<string, string> = { preconsultation: "Pré-consultation", declarations: "Déclarations", consultations: "Consultations", documents: "Documents médicaux (lecture seule)" };

export function ProfessionalAccessGrants() {
  const [items, setItems] = useState<ProfessionalGrant[]>(MOCK_GRANTS);
  const [qrToken, setQrToken] = useState("");
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("Chargement de vos demandes…");

  // Le bouton principal de la barre de navigation (« Scanner ») arrive ici avec #scanner : la caméra démarre et le formulaire passe au premier plan.
  useEffect(() => {
    const start = () => {
      if (window.location.hash !== "#scanner") return;
      setScanning(true);
      document.getElementById("nouvelle-demande")?.scrollIntoView({ block: "start" });
    };
    start();
    window.addEventListener("hashchange", start);
    return () => window.removeEventListener("hashchange", start);
  }, []);

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
    if (!qrToken.trim()) { setMessage("Scannez d’abord le QR du patient."); return; }
    setSubmitting(true);
    try {
      // Scanner le QR ouvre aussi la lecture seule des documents : le serveur l'ajoute toujours, le patient voit ce périmètre avant de décider.
      const created = await requestProfessionalGrant(["preconsultation", "declarations", "documents"], qrToken.trim());
      setItems((current) => [created, ...current]);
      setQrToken("");
      setMessage("Demande envoyée. Le patient doit l’accepter.");
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "Demande refusée.");
    } finally {
      setSubmitting(false);
    }
  }

  function onScanned(token: string) {
    setQrToken(token);
    setScanning(false);
    setMessage("QR lu. Vérifiez l’identité du patient, puis envoyez la demande.");
  }

  return <div className="stack-lg">
    <section className="hero-page"><span className="eyebrow">Accès au carnet</span><h1>Demander l’accès à un patient.</h1><p className="notice" role="status" aria-live="polite">{message}</p></section>
    <section className="patient-grid" aria-label="Demandes d’accès">
      <form id="nouvelle-demande" className="card" onSubmit={submit}>
        <span className="eyebrow">Nouvelle demande</span><h2>Présenter un patient</h2>
        <p className="muted">Scannez le QR affiché sur le téléphone du patient. Il est valable 5 minutes.</p>
        {scanning
          ? <QrScanner onResult={onScanned} onClose={() => setScanning(false)} />
          : qrToken
            ? <div className="qr-read" role="status"><strong>✓ QR du patient lu</strong><button type="button" className="button small" onClick={() => { setQrToken(""); setScanning(true); }}>Scanner à nouveau</button></div>
            : <div className="actions"><button type="button" className="button primary" onClick={() => setScanning(true)}>Scanner le QR du patient</button></div>}
        <p className="muted">Vous demandez la pré-consultation, les déclarations et la lecture des documents. Rien n’est ouvert avant l’accord du patient.</p>
        <button className="button primary" type="submit" disabled={submitting || !qrToken.trim()}>{submitting ? "Envoi…" : "Envoyer la demande"}</button>
      </form>
      <section id="historique" className="card"><span className="eyebrow">Historique</span><h2>Mes demandes</h2>{loading ? <p className="empty" role="status">Chargement…</p> : items.length === 0 ? <p className="empty">Aucune demande pour le moment.</p> : <div className="stack">{items.map((item) => <article className="record" key={item.id}><div><strong>{item.professional_name}</strong><p className="muted">{item.facility_label} · {item.scope.map((scope) => SCOPE_LABELS[scope] ?? scope).join(", ")}</p></div><span className={`badge ${item.status === "active" ? "verified" : "declared"}`}>{STATUS_LABELS[item.status] ?? item.status}</span></article>)}</div>}</section>
    </section>
  </div>;
}
