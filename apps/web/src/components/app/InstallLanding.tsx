"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { chromeIntentUrl, detectInstallEnvironment, type InstallEnvironment } from "../../lib/install-environment";
import { PROJECT_LOGO_WEBP } from "../../lib/brand";
import { Icon } from "../ui/Icon";
import "./install-landing.css";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
declare global { interface Window { __ecarnetInstallPrompt?: InstallPromptEvent } }

/** Page ouverte depuis le lien partagé (Paramètres › Partager l'application) : un geste suffit pour installer la PWA. */
export function InstallLanding() {
  const [env, setEnv] = useState<InstallEnvironment | null>(null);
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Premier relevé après l'affichage : le serveur ne connaît ni le navigateur ni l'appareil.
    const first = window.setTimeout(() => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      setEnv(detectInstallEnvironment(navigator.userAgent, standalone, navigator.maxTouchPoints));
      // Le navigateur peut avoir proposé l'installation avant l'affichage de la page : le script de la page l'a gardée.
      if (window.__ecarnetInstallPrompt) setPromptEvent(window.__ecarnetInstallPrompt);
    }, 0);
    const onPrompt = (event: Event) => { event.preventDefault(); window.__ecarnetInstallPrompt = event as InstallPromptEvent; setPromptEvent(event as InstallPromptEvent); };
    const onInstalled = () => { setInstalled(true); setPromptEvent(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.clearTimeout(first); window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    else setMessage("Installation annulée. Vous pouvez la relancer quand vous voulez.");
    window.__ecarnetInstallPrompt = undefined;
    setPromptEvent(null);
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); setMessage("Lien copié : collez-le dans votre navigateur."); } catch { setMessage("Copie impossible : copiez l’adresse depuis la barre du navigateur."); }
  }

  let body;
  if (!env) body = <p className="muted" role="status">Préparation…</p>;
  else if (installed || env.standalone) {
    body = <>
      <p className="notice" role="status">{installed ? "Mon E‑Carnet est installé. Retrouvez-le sur votre écran d’accueil." : "Mon E‑Carnet est déjà installé sur cet appareil."}</p>
      <div className="actions"><Link className="button primary" href="/connexion">Ouvrir l’application</Link></div>
    </>;
  } else if (env.inApp) {
    body = <>
      <p className="notice" role="status">Ce lien est ouvert dans une application (Facebook, WhatsApp, Instagram…) qui ne permet pas d’installer Mon E‑Carnet. Ouvrez-le d’abord dans votre navigateur.</p>
      <ol className="install-landing__steps">
        <li>Touchez le menu <strong>⋮</strong> ou <strong>…</strong> en haut ou en bas de l’écran.</li>
        <li>Choisissez <strong>« Ouvrir dans le navigateur »</strong> (Chrome, Safari…).</li>
        <li>Touchez ensuite <strong>« Installer l’application »</strong>.</li>
      </ol>
      <div className="actions">
        {env.android && <a className="button primary" href={chromeIntentUrl(window.location)}>Ouvrir dans Chrome</a>}
        <button type="button" className={env.android ? "button" : "button primary"} onClick={() => void copyLink()}><Icon name="link" size={18} /> Copier le lien</button>
      </div>
    </>;
  } else if (promptEvent) {
    body = <div className="actions"><button type="button" className="button primary install-landing__cta" onClick={() => void install()}><Icon name="download" size={20} /> Installer l’application</button></div>;
  } else if (env.ios) {
    body = <>
      <p className="muted">Sur iPhone et iPad, l’installation se fait depuis Safari :</p>
      <ol className="install-landing__steps">
        <li>Touchez le bouton <strong>Partager</strong> (le carré avec une flèche vers le haut).</li>
        <li>Faites défiler et choisissez <strong>« Sur l’écran d’accueil »</strong>.</li>
        <li>Touchez <strong>« Ajouter »</strong>. L’icône Mon E‑Carnet apparaît sur votre écran d’accueil.</li>
      </ol>
    </>;
  } else {
    body = <>
      <p className="muted">Votre navigateur ne propose pas encore l’installation automatique. Ouvrez son menu <strong>⋮</strong> et choisissez <strong>« Installer l’application »</strong> ou <strong>« Ajouter à l’écran d’accueil »</strong>. Sur ordinateur, cherchez l’icône d’installation à droite de la barre d’adresse.</p>
    </>;
  }

  return (
    <section className="card install-landing" aria-labelledby="install-title">
      {/* eslint-disable-next-line @next/next/no-img-element -- icône de marque locale, décorative */}
      <img className="install-landing__logo" src={PROJECT_LOGO_WEBP} alt="" width={84} height={84} draggable={false} />
      <span className="eyebrow">Application gratuite</span>
      <h1 id="install-title">Installez Mon E‑Carnet</h1>
      <p className="lead">Votre carnet de santé personnel, sur l’écran d’accueil de votre téléphone : ouverture en un geste, plein écran, consultation hors connexion de votre copie chiffrée.</p>
      {body}
      {message && <p className="notice" role="status" aria-live="polite">{message}</p>}
      {!installed && !env?.standalone && <p className="install-landing__skip"><Link href="/">Continuer dans le navigateur</Link></p>}
    </section>
  );
}
