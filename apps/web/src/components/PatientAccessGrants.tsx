"use client";

import { useEffect, useState } from "react";
import { notifyProductActionCompleted, primeCsrf, readCsrfToken } from "../infrastructure/api/client";
import { usePatientAccessQr } from "./shell/SpaceShell";
import { useConfirm } from "./modal/ConfirmProvider";

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
  resource_type?: string | null;
  resource_count?: number | null;
  access_duration_minutes?: number | null;
  authorized_until?: string | null;
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
const resourceLabels: Record<string, string> = {
  preconsultation: "vos pré-consultations",
  consultation: "vos consultations",
  declaration: "vos déclarations",
};

function eventDescription(event: AccessEvent): string {
  if (event.event_type === "clinical_data.read") {
    const resourceNoun = event.resource_type === "preconsultation" ? "pré-consultation" : event.resource_type === "consultation" ? "consultation" : event.resource_type === "declaration" ? "déclaration" : "élément de votre carnet";
    const count = event.resource_count;
    const quantity = typeof count === "number" ? `${count} ${resourceNoun}${count === 1 ? "" : "s"}` : resourceLabels[event.resource_type ?? ""] ?? "des éléments de votre carnet";
    const duration = event.access_duration_minutes;
    const durationText = typeof duration === "number" ? ` L’autorisation était valable ${duration / 60} h` : "";
    return `${event.professional_name} a consulté ${quantity} dans le cadre de son accès autorisé.${durationText}.`;
  }
  const labels: Record<string, string> = {
    requested: `${event.professional_name} a demandé un accès à votre carnet.`,
    accept: "Vous avez autorisé cet accès.",
    refuse: "Vous avez refusé cette demande d’accès.",
    extend: "Vous avez prolongé cet accès.",
    revoke: "Vous avez révoqué cet accès.",
    expired: "Cet accès a expiré.",
  };
  return labels[event.action] ?? actionLabels[event.action] ?? "Événement lié à un accès.";
}

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
  const { qr, setQr } = usePatientAccessQr();
  const [qrBusy, setQrBusy] = useState(false);
  const confirm = useConfirm();

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
      notifyProductActionCompleted(`/api/v1/patient/care/access-grants/${id}/${action}/`, "POST");
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
      notifyProductActionCompleted("/api/v1/patient/care/access-qr/", "POST");
      setQr({ token: payload.data.token, expiresAt: Date.now() + payload.data.expires_in_seconds * 1000 });
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
        {!qr ? <button type="button" className="button primary" onClick={() => void createQr()} disabled={qrBusy}>{qrBusy ? "Génération…" : "Générer un QR temporaire"}</button> : (
          <p className="notice">Votre QR est affiché en haut de l’espace Patient et reste visible pendant votre navigation jusqu’à son expiration.</p>
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
                <p className="muted">Périmètre demandé : {item.scope.map((scope) => scopeLabels[scope] ?? scope).join(", ") || "À préciser"}</p>
                {item.status === "pending" && <p className="consent-explanation">Si vous autorisez : accès pendant <strong>2 heures</strong>, prolongeable deux fois d’une heure. Le professionnel ne verra que le périmètre affiché ci-dessus. Les documents sont exclus. <strong>Aucune donnée n’est accessible avant votre décision.</strong></p>}
                <p className="muted">Durée initiale : 2 h, prolongeable deux fois d’1 h. {item.status === "active" && item.expires_at ? `Expiration : ${new Date(item.expires_at).toLocaleString("fr-FR")}.` : ""}</p>
                <div className="actions">
                  {item.status === "pending" && <>
                    <button type="button" className="button consent-decision" disabled={busyId === item.id} onClick={() => act(item.id, "accept")}>Autoriser pendant 2 h</button>
                    <button type="button" className="button consent-decision" disabled={busyId === item.id} onClick={() => act(item.id, "refuse")}>Refuser</button>
                  </>}
                  {item.status === "active" && <>
                    <button type="button" className="button" disabled={busyId === item.id || item.extension_count >= 2} onClick={() => act(item.id, "extend")}>Prolonger 1 h ({Math.max(0, 2 - item.extension_count)} restante{item.extension_count === 1 ? "" : "s"})</button>
                    <button type="button" className="button" disabled={busyId === item.id} onClick={() => void confirm({ title: "Révoquer cet accès maintenant ?", message: `${item.professional_name} perdra immédiatement l’accès à votre carnet.`, note: "L’autorisation apparaîtra comme « Révoquée » dans votre liste.", confirmLabel: "Révoquer l’accès", cancelLabel: "Garder l’accès", tone: "danger", mood: "question" }).then((ok) => { if (ok) void act(item.id, "revoke"); })}>Révoquer maintenant</button>
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
                <div><strong>{eventDescription(event)}</strong><p className="muted">{event.facility_label}{event.authorized_until ? ` · accès valable jusqu’au ${new Date(event.authorized_until).toLocaleString("fr-FR")}` : ""}{event.status ? ` · statut : ${statusLabels[event.status] ?? event.status}` : ""}</p></div>
                <time className="muted" dateTime={event.created_at}>{new Date(event.created_at).toLocaleString("fr-FR")}</time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}
