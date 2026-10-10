"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { primeCsrf, readCsrfToken } from "../infrastructure/api/client";

type Grant = {
  id: string;
  professional_name: string;
  facility_label: string;
  scope: string[];
  status: string;
  starts_at: string | null;
  expires_at: string | null;
  extension_count: number;
};

type AccessEvent = {
  id: string;
  event_type: string;
  action: string;
  status: string | null;
  extension_count: number | null;
  professional_name: string;
  facility_label: string;
  created_at: string;
};

const API = "";
const statusLabels: Record<string, string> = {
  pending: "En attente de votre décision",
  active: "Accès actif",
  refused: "Refusée",
  expired: "Expirée",
  revoked: "Révoquée",
};
const scopeLabels: Record<string, string> = {
  preconsultation: "Pré-consultation",
  declarations: "Déclarations",
  consultations: "Consultations",
  };
const actionLabels: Record<string, string> = {
  requested: "Demande créée",
  accept: "Accès autorisé",
  refuse: "Accès refusé",
  extend: "Accès prolongé",
  revoke: "Accès révoqué",
  expired: "Accès expiré",
};

async function getData<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, { credentials: "include", cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? "Demandes indisponibles.");
  return payload.data as T;
}

export function PatientAccessGrants() {
  const [items, setItems] = useState<Grant[]>([]);
  const [events, setEvents] = useState<AccessEvent[]>([]);
  const [message, setMessage] = useState("Chargement des demandes…");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrExpiresAt, setQrExpiresAt] = useState<number | null>(null);
  const [qrBusy, setQrBusy] = useState(false);

  async function refresh() {
    const [grants, history] = await Promise.all([
      getData<Grant[]>("/api/v1/patient/care/access-grants/"),
      getData<AccessEvent[]>("/api/v1/patient/care/access-audit/"),
    ]);
    setItems(grants);
    setEvents(history);
    setMessage("Demandes et historique chargés.");
  }

  useEffect(() => {
    let active = true;
    async function loadInitialData() {
      try {
        const [grants, history] = await Promise.all([
          getData<Grant[]>("/api/v1/patient/care/access-grants/"),
          getData<AccessEvent[]>("/api/v1/patient/care/access-audit/"),
        ]);
        if (!active) return;
        setItems(grants); setEvents(history); setMessage("Demandes et historique chargés.");
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Demandes indisponibles.");
      }
    }
    void loadInitialData();
    return () => { active = false; };
  }, []);

  async function act(id: string, action: "accept" | "refuse" | "extend" | "revoke") {
    setBusyId(id);
    try {
      const csrf = await primeCsrf();
      const token = readCsrfToken();
      const response = await fetch(`${API}/api/v1/patient/care/access-grants/${id}/${action}/`, {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRFToken": token },
      });
      const payload = await response.json();
      if (!csrf.ok || !response.ok) throw new Error(payload.message ?? "Action impossible.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action impossible.");
    } finally {
      setBusyId(null);
    }
  }

  async function createQr() {
    setQrBusy(true);
    try {
      const csrf = await primeCsrf();
      const token = readCsrfToken();
      const response = await fetch(`${API}/api/v1/patient/care/access-qr/`, { method: "POST", credentials: "include", headers: { "X-CSRFToken": token } });
      const payload = await response.json();
      if (!csrf.ok || !response.ok) throw new Error(payload.message ?? "QR indisponible.");
      setQrToken(payload.data.token);
      setQrExpiresAt(Date.now() + payload.data.expires_in_seconds * 1000);
      setMessage("QR temporaire généré. Il expire automatiquement dans 5 minutes.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible de générer le QR.");
    } finally { setQrBusy(false); }
  }

  return (
    <section className="hero-page">
      <span className="eyebrow">Mon carnet · consentement</span>
      <h1>Qui peut accéder à mon carnet ?</h1>
      <p className="muted">Chaque demande affiche le professionnel, l’établissement, le périmètre et la durée. Aucun accès n’est ouvert avant votre choix.</p>
      <p className="notice" role="status" aria-live="polite">{message}</p>

      <section className="card" aria-labelledby="qr-heading">
        <span className="eyebrow">Accès temporaire</span>
        <h2 id="qr-heading">Présenter mon QR à un professionnel</h2>
        <p className="muted">Le QR contient uniquement un jeton opaque à usage unique. Il ne contient aucune donnée médicale.</p>
        {!qrToken ? <button type="button" className="button primary" onClick={() => void createQr()} disabled={qrBusy}>{qrBusy ? "Génération…" : "Générer un QR temporaire"}</button> : (
          <div className="qr-panel">
            <QRCodeSVG value={qrToken} size={240} includeMargin aria-label="QR temporaire d’accès au carnet" />
            <p className="muted">Valable jusqu’à {qrExpiresAt ? new Date(qrExpiresAt).toLocaleTimeString("fr-FR") : "expiration automatique"}. Une seule demande peut le consommer.</p>
            <button type="button" className="button" onClick={() => { setQrToken(null); setQrExpiresAt(null); }}>Masquer le QR</button>
          </div>
        )}
      </section>

      <section aria-labelledby="active-access-heading">
        <h2 id="active-access-heading">Demandes et autorisations</h2>
        {items.length === 0 ? (
          <div className="card empty">Aucune demande d’accès pour le moment.</div>
        ) : (
          <div className="stack">
            {items.map((item) => (
              <article className="card" key={item.id}>
                <div className="section-heading">
                  <div><h3>{item.professional_name}</h3><p className="muted">{item.facility_label}</p></div>
                  <span className={item.status === "active" ? "badge verified" : "badge declared"}>{statusLabels[item.status] ?? item.status}</span>
                </div>
                <p className="muted">Périmètre : {item.scope.map((scope) => scopeLabels[scope] ?? scope).join(", ") || "À préciser"}</p>
                <p className="muted">Durée initiale : 2 h, prolongeable deux fois d’1 h. {item.status === "active" && item.expires_at ? `Expiration : ${new Date(item.expires_at).toLocaleString("fr-FR")}.` : ""}</p>
                <div className="actions">
                  {item.status === "pending" && <>
                    <button type="button" className="button primary" disabled={busyId === item.id} onClick={() => act(item.id, "accept")}>Autoriser 2 h</button>
                    <button type="button" className="button" disabled={busyId === item.id} onClick={() => act(item.id, "refuse")}>Refuser</button>
                  </>}
                  {item.status === "active" && <>
                    <button type="button" className="button" disabled={busyId === item.id || item.extension_count >= 2} onClick={() => act(item.id, "extend")}>Prolonger 1 h ({Math.max(0, 2 - item.extension_count)} restante{item.extension_count === 1 ? "" : "s"})</button>
                    <button type="button" className="button" disabled={busyId === item.id} onClick={() => act(item.id, "revoke")}>Révoquer maintenant</button>
                  </>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="access-history-heading" className="card" style={{ marginTop: 28 }}>
        <h2 id="access-history-heading">Historique des accès</h2>
        {events.length === 0 ? <p className="empty">Les décisions et changements d’accès apparaîtront ici.</p> : (
          <ol className="stack">
            {events.map((event) => (
              <li className="record" key={event.id}>
                <div><strong>{actionLabels[event.action] ?? "Événement d’accès"}</strong><p className="muted">{event.professional_name} · {event.facility_label}</p></div>
                <time className="muted" dateTime={event.created_at}>{new Date(event.created_at).toLocaleString("fr-FR")}</time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}
