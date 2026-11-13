"use client";

import { useState, useSyncExternalStore } from "react";
import { Icon } from "../ui/Icon";

export const SHARE_PATH = "/installer";
const SHARE_TITLE = "Mon E‑Carnet";
const SHARE_TEXT = "Installe Mon E‑Carnet, le carnet de santé personnel, sur ton téléphone :";

const noopSubscribe = () => () => undefined;

/** Paramètres › Partager l'application : un lien unique (/installer) qui, ouvert, propose d'installer la PWA. */
export function ShareAppSettings() {
  // Adresse et menu de partage propres à l'appareil : absents du rendu serveur, lus par le navigateur ensuite.
  const url = useSyncExternalStore(noopSubscribe, () => `${window.location.origin}${SHARE_PATH}`, () => "");
  const canShare = useSyncExternalStore(noopSubscribe, () => typeof navigator.share === "function", () => false);
  const [status, setStatus] = useState("");

  async function nativeShare() {
    try {
      await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("Le partage n’a pas abouti. Essayez « Copier le lien ».");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Lien copié.");
    } catch {
      setStatus("Copie impossible sur cet appareil. Utilisez « Partager… » pour envoyer le lien.");
    }
  }

  return (
    <div className="settings-modal-section share-app">
      <span className="eyebrow">Faire connaître l’application</span>
      <p className="muted">Envoyez ce lien : en l’ouvrant, la personne peut installer Mon E‑Carnet sur son téléphone ou son ordinateur en un geste.</p>
      <div className="actions">
        {canShare && <button type="button" className="button primary" onClick={() => void nativeShare()} disabled={!url}><Icon name="share" size={18} /> Partager…</button>}
        <button type="button" className={canShare ? "button" : "button primary"} onClick={() => void copy()} disabled={!url}><Icon name="link" size={18} /> Copier le lien</button>
      </div>
      <p id="share-status" className="notice" role="status" aria-live="polite" hidden={!status}>{status}</p>
      <p className="settings-note muted">Le lien ne contient aucune information sur vous ni sur votre carnet.</p>
    </div>
  );
}
