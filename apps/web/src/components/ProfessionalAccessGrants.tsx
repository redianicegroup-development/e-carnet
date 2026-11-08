"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../infrastructure/api/client";
import { endProfessionalGrant, listProfessionalGrants, ProfessionalGrant, requestProfessionalGrant } from "../application/professional-access-grants";
import { useConfirm } from "./modal/ConfirmProvider";
import { formatClock, formatWhen, timeLeft } from "./access/access-history";
import { QrScanner } from "./QrScanner";
import { PersonAvatar } from "./ui/PersonAvatar";
import { EstablishmentLogo } from "./EstablishmentLogo";
import "./establishment-logo.css";
import "./consultation-flow.css";

const MOCK_GRANTS: ProfessionalGrant[] = [];
const STATUS_LABELS: Record<string, string> = { pending: "En attente du patient", active: "Accès ouvert", refused: "Refusé", expired: "Expiré", revoked: "Révoqué" };
const SCOPE_LABELS: Record<string, string> = { preconsultation: "Pré-consultation", declarations: "Déclarations", consultations: "Consultations", documents: "Documents médicaux (lecture seule)" };
/** Le scan réussi mène droit à la consultation du patient : la page « Suivi » ouvre son dossier à partir de ce paramètre. */
const CONSULTATION_PATH = "/professionnel/consultations";

/** Dernière ligne d'une carte : toujours présente, pour que toutes les cartes aient la même hauteur. */
function stateLine(item: ProfessionalGrant): string {
  if (item.status === "active") { const left = timeLeft(item.expires_at); return left ? `Il reste ${left} · jusqu’à ${formatClock(item.expires_at)}` : "Se termine à l’instant"; }
  if (item.status === "expired") return `Terminé · ${formatWhen(item.expires_at)}`;
  if (item.status === "pending") return "Le patient doit l’accepter";
  return "";
}

export function ProfessionalAccessGrants() {
  const [items, setItems] = useState<ProfessionalGrant[]>(MOCK_GRANTS);
  const [qrToken, setQrToken] = useState("");
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("Chargement de vos demandes…");
  const [endingId, setEndingId] = useState<string | null>(null);
  const confirm = useConfirm();
  const router = useRouter();
  const opening = useRef(false);
  const [formError, setFormError] = useState("");

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

  /** Ouvre l'accès avec le QR lu. Le scan vaut accord du patient : dès que l'accès est actif, on ouvre sa consultation, sans autre clic. */
  async function openAccess(rawToken: string) {
    const token = rawToken.trim();
    if (!token) { setFormError("Scannez d’abord le QR du patient."); return; }
    if (opening.current) return; // un seul envoi à la fois (double lecture de la caméra, double clic)
    opening.current = true;
    setSubmitting(true);
    setFormError("");
    try {
      // Scanner le QR ouvre aussi la lecture seule des documents : le serveur l'ajoute toujours. Le patient a présenté son QR lui-même : l'accès s'ouvre tout de suite (2 h), à un seul professionnel à la fois.
      const created = await requestProfessionalGrant(["preconsultation", "declarations", "documents"], token);
      setItems((current) => [created, ...current]);
      setQrToken("");
      if (created.status === "active") {
        setMessage("Accès ouvert pour 2 h. Ouverture de la consultation du patient…");
        router.push(`${CONSULTATION_PATH}?acces=${encodeURIComponent(created.id)}`);
        return;
      }
      setMessage("Demande envoyée. Le patient doit l’accepter.");
    } catch (error) {
      // Le QR reste lu : si le patient est encore connecté à un confrère, « Ouvrir l'accès » réessaie avec le même QR (il n'est pas consommé).
      const text = error instanceof ApiError ? error.message : "Demande refusée.";
      setFormError(text);
      setMessage(text);
    } finally {
      opening.current = false;
      setSubmitting(false);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    void openAccess(qrToken);
  }

  function onScanned(token: string) {
    setQrToken(token);
    setScanning(false);
    setMessage("QR lu. Ouverture de l’accès…");
    void openAccess(token);
  }

  /** Fin de consultation : libère le patient pour un autre professionnel sans attendre l'expiration des 2 h. */
  async function endGrant(item: ProfessionalGrant) {
    const ok = await confirm({ title: "Terminer l’accès à ce patient ?", message: `Vous ne pourrez plus consulter le carnet de ${item.patient_name || "ce patient"}. Le patient pourra se connecter à un autre professionnel.`, note: "Pour revenir, le patient devra présenter un nouveau QR.", confirmLabel: "Terminer l’accès", cancelLabel: "Garder l’accès", tone: "danger", mood: "question" });
    if (!ok) return;
    setEndingId(item.id);
    try {
      const ended = await endProfessionalGrant(item.id);
      setItems((current) => current.map((entry) => entry.id === ended.id ? { ...entry, ...ended } : entry));
      setMessage("Accès terminé. Le patient peut se connecter à un autre professionnel.");
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "Impossible de terminer l’accès.");
    } finally {
      setEndingId(null);
    }
  }

  return <div className="stack-lg">
    <section className="hero-page"><h1>Ouvrir l’accès à un patient.</h1><p className="notice" role="status" aria-live="polite">{message}</p></section>
    <section className="patient-grid" aria-label="Demandes d’accès">
      <form id="nouvelle-demande" className="card" onSubmit={submit}>
        <h2>Présenter un patient</h2>
        <p className="muted">Scannez le QR affiché sur le téléphone du patient (valable 5 minutes) : l’accès s’ouvre et sa consultation s’affiche aussitôt.</p>
        {scanning
          ? <QrScanner onResult={onScanned} onClose={() => setScanning(false)} />
          : qrToken
            ? <div className="qr-read" role="status"><strong>✓ QR du patient lu</strong><button type="button" className="button small" onClick={() => { setQrToken(""); setScanning(true); }}>Scanner à nouveau</button></div>
            : <div className="actions"><button type="button" className="button primary" onClick={() => setScanning(true)}>Scanner le QR du patient</button></div>}
        <p className="muted">En scannant ce QR, vous ouvrez pour 2 heures la pré-consultation, les déclarations et la lecture des documents. Le patient l’a présenté lui-même : c’est son accord. Un seul professionnel peut être connecté à un patient à la fois. L’accès se ferme tout seul quand vous signez la consultation.</p>
        {formError && <p className="status" role="alert">{formError}</p>}
        <button className="button primary" type="submit" disabled={submitting || !qrToken.trim()}>{submitting ? "Ouverture…" : "Ouvrir l’accès"}</button>
      </form>
      <section id="historique" className="card"><h2>Mes demandes</h2>{loading ? <p className="empty" role="status">Chargement…</p> : items.length === 0 ? <p className="empty">Aucune demande pour le moment.</p> : <div className="request-list">{items.map((item) => {
        const who = item.patient_name || `Patient · accès ${item.reference}`;
        const scopes = item.scope.map((scope) => SCOPE_LABELS[scope] ?? scope).join(" · ");
        const line = stateLine(item);
        return <article className="record request-row" data-status={item.status} key={item.id}>
          <div className="request-row__who"><span className="request-row__avatars"><PersonAvatar src={item.patient_avatar} name={item.patient_name || item.reference} size={46} /><EstablishmentLogo logo={item.establishment_logo} name={item.facility_label} size={22} /></span><div><strong title={who}>{who}</strong><span className="muted request-row__facility" title={item.facility_label}>{item.facility_label}</span></div></div>
          <p className="muted request-row__scope" title={scopes}>{scopes}</p>
          <div className="request-row__foot"><div className="request-row__state"><span className={`badge ${item.status === "active" ? "verified" : "declared"}`}>{STATUS_LABELS[item.status] ?? item.status}</span>{line && <small className="muted">{line}</small>}</div>{item.status === "active" && <button type="button" className="button small danger" onClick={() => void endGrant(item)} disabled={endingId === item.id}>{endingId === item.id ? "Fin de l’accès…" : "Terminer l’accès"}</button>}</div>
        </article>;
      })}</div>}</section>
    </section>
  </div>;
}
