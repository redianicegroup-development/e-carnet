"use client";

import { useEffect, useState } from "react";
import { Icon } from "./ui/Icon";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function PwaInstallButton() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => { event.preventDefault(); setPromptEvent(event as InstallPromptEvent); };
    const onInstalled = () => { setInstalled(true); setPromptEvent(null); setHelp(false); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  async function install() {
    if (!promptEvent) { setHelp(true); return; }
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPromptEvent(null);
  }

  if (installed) return <p className="pwa-install-note" role="status">Mon E‑Carnet est installé sur cet appareil.</p>;
  return <div className="pwa-install-wrap">
    <button className="button primary pwa-install-button" type="button" onClick={() => void install()}><Icon name="plus" size={17} /> Installer l’application</button>
    {help && <p className="pwa-install-note" role="status">Dans le menu de votre navigateur, choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».</p>}
  </div>;
}
