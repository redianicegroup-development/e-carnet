"use client";

import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { notifyProductActionCompleted, primeCsrf, readCsrfToken } from "../infrastructure/api/client";
import { useConfirm } from "./modal/ConfirmProvider";
import { usePatientAccessQr } from "./shell/SpaceShell";
import { AccessWho, ProfessionalHistoryDialog, ProfessionalHistoryList } from "./access/AccessHistory";
import { SCOPE_LABELS, STATUS_LABELS, formatClock, groupByProfessional, splitGrants, timeLeft, type AccessEvent, type Grant } from "./access/access-history";
import { concernsAccess, useNewNotifications } from "./notifications/notification-events";

const API = "";
const LOADED_MESSAGE = "Demandes et historique chargés.";

export function ActiveAccessQr({ token, expiresAt, busy, onRenew }: { token: string; expiresAt: number; busy: boolean; onRenew: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  return (
    <div className="patient-active-qr" role="group" aria-label="QR temporaire actif">
      <div className="patient-active-qr__code">
        <QRCodeSVG value={token} size={184} includeMargin aria-label="QR temporaire d’accès au carnet" />
      </div>
      <div className="patient-active-qr__details">
        <span className="eyebrow">QR temporaire actif</span>
        <p className="patient-active-qr__countdown" role="timer" aria-live="off">Expire dans {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</p>
        <p className="muted">Montrez-le au professionnel pendant la consultation. Il reste ici si vous changez d’onglet.</p>
        <small className="muted">Jeton à usage unique : ne le partagez qu’avec le professionnel concerné. Un nouveau QR remplace celui-ci.</small>
        <div className="actions"><button type="button" className="button small" onClick={onRenew} disabled={busy}>{busy ? "Génération…" : "Générer un nouveau QR"}</button></div>
      </div>
    </div>
  );
}

async function getData<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, { credentials: "include", cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? "Demandes indisponibles.");
  return payload.data as T;
}

/* `part` : « all » = l'écran complet d'avant ; « qr » = le seul QR temporaire (étape 2 des consultations) ;
   « log » = les demandes à décider et l'historique des accès (page Historique). */
export function PatientAccessGrants({ part = "all" }: { part?: "all" | "qr" | "log" }) {
  const [items, setItems] = useState<Grant[]>([]);
  const [events, setEvents] = useState<AccessEvent[]>([]);
  const [message, setMessage] = useState("Chargement des demandes…");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
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
    setMessage(LOADED_MESSAGE);
  }

  // « Il reste 1 h 24 » se met à jour sans recharger la page.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // Temps réel : dès que la cloche reçoit une notification d'accès (QR scanné, accès terminé…), les listes se rechargent d'elles-mêmes.
  useNewNotifications(({ kinds }) => { if (concernsAccess(kinds)) void refresh().catch(() => undefined); });

  useEffect(() => {
    let active = true;
    async function loadInitialData() {
      try {
        const [grants, history] = await Promise.all([
          getData<Grant[]>("/api/v1/patient/care/access-grants/"),
          getData<AccessEvent[]>("/api/v1/patient/care/access-audit/"),
        ]);
        if (!active) return;
        setItems(grants); setEvents(history); setMessage(LOADED_MESSAGE);
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Demandes indisponibles.");
      }
    }
    void loadInitialData();
    return () => { active = false; };
  }, []);

  /* Autoriser, refuser ou prolonger un accès à son carnet : une décision de consentement, confirmée avant d'être envoyée. */
  async function decide(item: Grant, action: "accept" | "refuse" | "extend") {
    const shared = item.scope.map((entry) => SCOPE_LABELS[entry] ?? entry).join(", ");
    const copy = {
      accept: { title: "Autoriser cet accès ?", message: `${item.professional_name} (${item.facility_label}) pourra consulter ${shared ? `ces éléments de votre carnet : ${shared}` : "les éléments demandés de votre carnet"} pendant 2 heures.`, note: "Vous pourrez le révoquer à tout moment.", confirmLabel: "Autoriser 2 h" },
      refuse: { title: "Refuser cette demande ?", message: `${item.professional_name} (${item.facility_label}) ne recevra aucun accès à votre carnet.`, note: "Le professionnel pourra renvoyer une nouvelle demande.", confirmLabel: "Refuser la demande" },
      extend: { title: "Prolonger l’accès d’une heure ?", message: `${item.professional_name} gardera l’accès à votre carnet une heure de plus.`, note: "Un accès peut être prolongé deux fois au maximum.", confirmLabel: "Prolonger d’1 h" },
    }[action];
    if (await confirm({ ...copy, cancelLabel: "Annuler" })) await act(item.id, action);
  }

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

  const histories = useMemo(() => groupByProfessional(events, items), [events, items]);
  const opened = histories.find((history) => history.key === openKey) ?? null;
  const { current, past } = useMemo(() => splitGrants(items), [items]);
  const historyOf = (grantId: string) => histories.find((history) => history.sessions.some((session) => session.id === grantId)) ?? null;

  return (
    <section className={part === "all" ? "hero-page" : "stack"}>
      {part === "all" && <>
        <span className="eyebrow">Mon carnet · consentement</span>
        <h1>Qui peut accéder à mon carnet ?</h1>
        <p className="muted">Montrer votre QR vaut accord : le professionnel qui le scanne accède à votre carnet pendant 2 h (lecture seule), et lui seul. Vous pouvez mettre fin à l’accès depuis cet historique.</p>
      </>}
      <p className={message === LOADED_MESSAGE ? "sr-only" : "notice"} role="status" aria-live="polite">{message}</p>

      {part !== "log" && <section id="qr" className="card" aria-labelledby="qr-heading">
        <span className="eyebrow">Accès temporaire</span>
        <h2 id="qr-heading">Accès temporaire pour un professionnel</h2>
        <p className="muted">Ce n’est pas le QR de votre carte virtuelle : celui-ci expire au bout de 5 minutes. Dès qu’un professionnel le scanne, il peut consulter vos informations et vos documents (lecture seule) pendant 2 heures, sans autre validation de votre part. Un seul professionnel peut être connecté à la fois, et vous pouvez mettre fin à son accès depuis l’historique.</p>
        {!qr
          ? <button type="button" className="button primary" onClick={() => void createQr()} disabled={qrBusy}>{qrBusy ? "Génération…" : "Générer un QR temporaire"}</button>
          : <ActiveAccessQr token={qr.token} expiresAt={qr.expiresAt} busy={qrBusy} onRenew={() => void createQr()} />}
      </section>}

      {part !== "qr" && <section aria-labelledby="active-access-heading">
        <h2 id="active-access-heading">Demandes et autorisations</h2>
        {items.length === 0 ? (
          <div className="card empty">Aucun accès pour le moment. Quand un professionnel scannera votre QR, il apparaîtra ici avec sa photo.</div>
        ) : (
          <div className="stack">
            {current.map((item) => {
              const left = item.status === "active" ? timeLeft(item.expires_at, now) : null;
              const history = historyOf(item.id);
              return (
                <article className="card access-card" key={item.id}>
                  <div className="access-card__top">
                    <AccessWho name={item.professional_name} avatar={item.professional_avatar} logo={item.establishment_logo} facility={item.facility_label} subtitle={item.professional_title} size={56} />
                    <span className={item.status === "active" ? "badge verified" : "badge declared"}>{STATUS_LABELS[item.status] ?? item.status}</span>
                  </div>
                  <p className="muted">{item.status === "active" ? "Peut consulter" : "Accès demandé"} : {item.scope.map((scope) => SCOPE_LABELS[scope] ?? scope).join(", ") || "À préciser"}</p>
                  {item.status === "pending" && <p className="consent-explanation">Si vous autorisez : accès pendant <strong>2 heures</strong> (prolongeable deux fois d’une heure), limité à ce qui est listé ci-dessus. <strong>Rien n’est accessible avant votre décision.</strong></p>}
                  {item.status === "active" && item.expires_at && <p className="access-card__time">{left ? `Il reste ${left}` : "Se termine à l’instant"} · jusqu’à {formatClock(item.expires_at)}</p>}
                  <div className="actions">
                    {item.status === "pending" && <>
                      <button type="button" className="button consent-decision" disabled={busyId === item.id} onClick={() => void decide(item, "accept")}>Autoriser pendant 2 h</button>
                      <button type="button" className="button consent-decision" disabled={busyId === item.id} onClick={() => void decide(item, "refuse")}>Refuser</button>
                    </>}
                    {item.status === "active" && <>
                      <button type="button" className="button" disabled={busyId === item.id || item.extension_count >= 2} onClick={() => void decide(item, "extend")}>Prolonger 1 h ({Math.max(0, 2 - item.extension_count)} restante{item.extension_count === 0 ? "s" : ""})</button>
                      <button type="button" className="button primary danger" disabled={busyId === item.id} onClick={() => void confirm({ title: "Révoquer cet accès maintenant ?", message: `${item.professional_name} perdra immédiatement l’accès à votre carnet.`, note: "L’accès apparaîtra comme « Révoquée » dans votre historique.", confirmLabel: "Révoquer l’accès", cancelLabel: "Garder l’accès", tone: "danger", mood: "question" }).then((ok) => { if (ok) void act(item.id, "revoke"); })}>Révoquer maintenant</button>
                    </>}
                    {history && <button type="button" className="button" onClick={() => setOpenKey(history.key)} aria-haspopup="dialog">Voir son historique</button>}
                  </div>
                </article>
              );
            })}
            {past.length > 0 && <>
              <h3 className="access-past__title">Accès terminés</h3>
              <ul className="access-past">
                {past.map((item) => {
                  const history = historyOf(item.id);
                  const row = <>
                    <AccessWho name={item.professional_name} avatar={item.professional_avatar} logo={item.establishment_logo} facility={item.facility_label} subtitle={item.professional_title} size={40} />
                    <span className="badge declared">{STATUS_LABELS[item.status] ?? item.status}</span>
                  </>;
                  return <li key={item.id}>{history
                    ? <button type="button" className="access-past__row" onClick={() => setOpenKey(history.key)} aria-haspopup="dialog" aria-label={`Voir l’historique de ${item.professional_name}`}>{row}</button>
                    : <div className="access-past__row">{row}</div>}</li>;
                })}
              </ul>
            </>}
          </div>
        )}
      </section>}

      {part !== "qr" && <section aria-labelledby="access-history-heading" className="card">
        <h2 id="access-history-heading">Historique des accès</h2>
        {histories.length === 0 ? <p className="empty">Les décisions et changements d’accès apparaîtront ici.</p> : <>
          <p className="muted">Touchez un professionnel pour voir tout ce qu’il a fait avec vos accès.</p>
          <ProfessionalHistoryList histories={histories} onOpen={(history) => setOpenKey(history.key)} />
        </>}
      </section>}
      {opened && <ProfessionalHistoryDialog history={opened} onClose={() => setOpenKey(null)} />}
    </section>
  );
}
