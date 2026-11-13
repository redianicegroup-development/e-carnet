"use client";

import { DATA_SAVER_CHOICES } from "../../lib/data-saver";
import { useDataSaver } from "./useDataSaver";
import "../access-summary-settings.css";

/* Paramètres › Économie de données (PAT-20) : Automatique / Toujours / Jamais. Le choix reste sur l'appareil. */
export function DataSaverSettings() {
  const { setting, active, reason, setSetting } = useDataSaver();
  return <div className="access-summary">
    <fieldset className="access-summary__choices">
      <legend>Économie de données</legend>
      {DATA_SAVER_CHOICES.map((choice) => <label key={choice.value} className={`access-summary__choice${setting === choice.value ? " is-selected" : ""}`}>
        <input type="radio" name="data-saver" value={choice.value} checked={setting === choice.value} onChange={() => setSetting(choice.value)} />
        <span><strong>{choice.label}</strong><small className="muted">{choice.hint}</small></span>
      </label>)}
    </fieldset>
    <p className="notice" role="status" aria-live="polite">{active ? `Actuellement activé. ${reason}` : "Actuellement désactivé."}</p>
    <p className="muted">Ce choix reste sur cet appareil. Il allège les pages et les photos envoyées ; il ne change rien à vos autorisations d’accès, à votre connexion ni à la sécurité de votre carnet.</p>
  </div>;
}
