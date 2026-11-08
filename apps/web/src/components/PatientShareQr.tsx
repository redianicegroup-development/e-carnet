"use client";

import { useRef, useState } from "react";
import { notifyProductActionCompleted, primeCsrf, readCsrfToken } from "../infrastructure/api/client";
import { ActiveAccessQr } from "./PatientAccessGrants";
import { useDialogBehavior } from "./modal/useDialogBehavior";
import { useNewNotifications } from "./notifications/notification-events";
import { usePatientAccessQr } from "./shell/SpaceShell";
import { Icon } from "./ui/Icon";
import "./modal/modal.css";

/* « Partager en QR » (accueil patient) : chaque clic génère un NOUVEAU QR temporaire de 5 minutes, celui de l'étape 2 de « Consultations »
   (même état partagé : le QR reste visible là-bas), et l'affiche tout de suite. Le jeton vient du serveur : il n'est jamais mis en cache hors connexion. */
async function requestAccessQr(): Promise<{ token: string; expiresAt: number }> {
  const csrf = await primeCsrf();
  const response = await fetch("/api/v1/patient/care/access-qr/", { method: "POST", credentials: "include", headers: { "X-CSRFToken": readCsrfToken() } });
  const payload = await response.json();
  if (!csrf.ok || !response.ok) throw new Error(payload.message ?? "QR indisponible.");
  notifyProductActionCompleted("/api/v1/patient/care/access-qr/", "POST");
  return { token: payload.data.token as string, expiresAt: Date.now() + Number(payload.data.expires_in_seconds) * 1000 };
}

export function PatientShareQrButton() {
  const { qr, setQr } = usePatientAccessQr();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState("");
  const dialog = useRef<HTMLElement>(null);
  useDialogBehavior({ open, container: dialog, onEscape: () => setOpen(false) });

  async function generate() {
    setBusy(true);
    setError("");
    try {
      setQr(await requestAccessQr());
    } catch (reason) {
      setQr(null);
      setError(typeof navigator !== "undefined" && navigator.onLine === false ? "Hors connexion : le QR temporaire se génère en ligne." : reason instanceof Error && reason.message && !(reason instanceof TypeError) ? reason.message : "Impossible de générer le QR. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  // Le QR est scanné : l'accès s'ouvre tout de suite, sans validation. La fenêtre le confirme en quelques secondes (le QR disparaît, il est à usage unique).
  useNewNotifications(({ items }) => {
    const opened = items.find((item) => item.kind === "access.opened");
    if (opened && open) setConnected(opened.body);
  });

  function openAndGenerate() {
    // Un QR déjà expiré n'est jamais montré comme valable : chaque ouverture repart d'un QR neuf.
    setConnected("");
    setOpen(true);
    void generate();
  }

  return (
    <>
      <button type="button" className="button dark" onClick={openAndGenerate} disabled={busy && !open}><Icon name="qr" size={18} /> Partager en QR</button>
      {open && (
        <div className="modal-backdrop modal-backdrop--confirm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section ref={dialog} className="modal-dialog share-qr-dialog" role="dialog" aria-modal="true" aria-labelledby="share-qr-title">
            <div className="modal-copy">
              <h2 id="share-qr-title">Partager en QR</h2>
              <p className="modal-message">Montrez ce QR au professionnel : dès qu’il le scanne, il accède à votre carnet pendant 2 h (lecture seule), sans autre validation. Un seul professionnel peut être connecté à la fois, et vous pouvez mettre fin à son accès dans l’historique. Chaque clic sur « Partager en QR » en génère un nouveau.</p>
            </div>
            {connected ? <p className="share-qr-connected" role="status"><Icon name="check" size={18} /> <span><strong>Accès ouvert.</strong> {connected}</span></p> : busy && !qr ? <p className="muted" role="status">Génération du QR…</p> : error ? <p className="status" role="alert">{error}</p> : qr ? <ActiveAccessQr token={qr.token} expiresAt={qr.expiresAt} busy={busy} onRenew={() => void generate()} /> : null}
            <div className="modal-actions">
              {error && <button type="button" className="button primary" onClick={() => void generate()} disabled={busy}>Réessayer</button>}
              <button type="button" className="button" onClick={() => setOpen(false)}>Fermer</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
