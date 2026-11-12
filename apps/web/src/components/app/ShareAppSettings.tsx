"use client";

import { useState, useSyncExternalStore } from "react";
import { Icon } from "../ui/Icon";

export const SHARE_PATH = "/installer";
const SHARE_TITLE = "Mon E‑Carnet";
const SHARE_TEXT = "Installe Mon E‑Carnet, le carnet de santé personnel, sur ton téléphone :";

const noopSubscribe = () => () => undefined;

export type ShareTarget = { id: string; label: string; href: string };

/** Liens de partage prêts à l'emploi pour les réseaux les plus utilisés (le menu natif du téléphone couvre tous les autres). */
export function shareTargets(url: string): ShareTarget[] {
  const link = encodeURIComponent(url);
  const text = encodeURIComponent(SHARE_TEXT);
  const both = encodeURIComponent(`${SHARE_TEXT} ${url}`);
  return [
    { id: "whatsapp", label: "WhatsApp", href: `https://wa.me/?text=${both}` },
    { id: "facebook", label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${link}` },
    { id: "telegram", label: "Telegram", href: `https://t.me/share/url?url=${link}&text=${text}` },
    { id: "x", label: "X", href: `https://twitter.com/intent/tweet?text=${text}&url=${link}` },
    { id: "linkedin", label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${link}` },
    { id: "sms", label: "SMS", href: `sms:?&body=${both}` },
    { id: "email", label: "E‑mail", href: `mailto:?subject=${encodeURIComponent(SHARE_TITLE)}&body=${both}` },
  ];
}

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
      if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("Le partage n’a pas abouti. Copiez le lien ci-dessous.");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Lien copié.");
    } catch {
      setStatus("Copie impossible : sélectionnez le lien et copiez-le.");
    }
  }

  return (
    <div className="settings-modal-section share-app">
      <span className="eyebrow">Faire connaître l’application</span>
      <p className="muted">Envoyez ce lien : en l’ouvrant, la personne peut installer Mon E‑Carnet sur son téléphone ou son ordinateur en un geste.</p>
      <label className="field"><span>Lien d’installation</span><input readOnly value={url} onFocus={(event) => event.currentTarget.select()} aria-describedby="share-status" /></label>
      <div className="actions">
        {canShare && <button type="button" className="button primary" onClick={() => void nativeShare()} disabled={!url}><Icon name="share" size={18} /> Partager…</button>}
        <button type="button" className={canShare ? "button" : "button primary"} onClick={() => void copy()} disabled={!url}><Icon name="link" size={18} /> Copier le lien</button>
      </div>
      <p id="share-status" className="notice" role="status" aria-live="polite" hidden={!status}>{status}</p>
      {url && <>
        <h3 className="share-app__title">Partager sur</h3>
        <ul className="share-app__targets">
          {shareTargets(url).map((target) => <li key={target.id}><a className="button" href={target.href} target={target.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">{target.label}</a></li>)}
        </ul>
      </>}
      <p className="settings-note muted">Le lien ne contient aucune information sur vous ni sur votre carnet.</p>
    </div>
  );
}
