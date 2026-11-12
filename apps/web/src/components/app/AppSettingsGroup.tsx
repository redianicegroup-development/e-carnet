"use client";

import { useState } from "react";
import { APP_VERSION, UPDATE_LABELS } from "../../lib/app-info";
import { languageInfo } from "../../lib/language";
import { SettingsModal } from "../SettingsModal";
import { Icon, type IconName } from "../ui/Icon";
import { AppVersionSettings } from "./AppVersionSettings";
import { LanguageSettings, useStoredLanguage } from "./LanguageSettings";
import { ShareAppSettings } from "./ShareAppSettings";
import { useAppUpdate } from "./use-app-update";
import "./app-settings.css";

type Panel = "langue" | "partage" | "version";

/** Bloc « À propos de l'application » de Paramètres, commun aux quatre espaces : langue, partage, version. */
export function AppSettingsGroup() {
  const [panel, setPanel] = useState<Panel | null>(null);
  const language = useStoredLanguage();
  const update = useAppUpdate();
  const close = () => setPanel(null);

  const rows: Array<{ id: Panel; icon: IconName; title: string; detail: string; aside?: string; asideClass?: string }> = [
    { id: "langue", icon: "globe", title: "Langue", detail: "Français, English ou العربية (Google Translate).", aside: languageInfo(language).native },
    { id: "partage", icon: "share", title: "Partager l’application", detail: "Envoyer le lien d’installation à vos proches." },
    { id: "version", icon: "refresh", title: "Version de l’application", detail: `Mon E‑Carnet v${APP_VERSION}`, aside: UPDATE_LABELS[update.status], asideClass: update.status === "available" ? " settings-app__aside--alert" : "" },
  ];

  return (
    <section className="settings-app" aria-labelledby="settings-app-title">
      <h3 id="settings-app-title" className="settings-app__title">À propos de l’application</h3>
      <div className="setting-list" role="group" aria-label="Langue, partage et version">
        {rows.map((row) => (
          <button type="button" className="setting-item" key={row.id} aria-haspopup="dialog" onClick={() => setPanel(row.id)}>
            <span className="setting-item__icon" aria-hidden="true"><Icon name={row.icon} size={20} /></span>
            <span className="setting-item__meta"><strong>{row.title}</strong><span>{row.detail}</span></span>
            {row.aside && <span className={`settings-app__aside${row.asideClass ?? ""}`} translate={row.id === "langue" ? "no" : undefined}>{row.aside}</span>}
            <span className="setting-item__chevron" aria-hidden="true">›</span>
          </button>
        ))}
      </div>
      {panel === "langue" && <SettingsModal title="Langue" onClose={close}><LanguageSettings /></SettingsModal>}
      {panel === "partage" && <SettingsModal title="Partager l’application" onClose={close}><ShareAppSettings /></SettingsModal>}
      {panel === "version" && <SettingsModal title="Version de l’application" onClose={close}><AppVersionSettings update={update} /></SettingsModal>}
    </section>
  );
}
