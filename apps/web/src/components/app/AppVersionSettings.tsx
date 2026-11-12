"use client";

import { APP_BUILD, APP_VERSION, UPDATE_LABELS, type UpdateStatus } from "../../lib/app-info";
import type { useAppUpdate } from "./use-app-update";

type Update = ReturnType<typeof useAppUpdate>;

const BADGE: Record<UpdateStatus, string> = { checking: "pending", current: "verified", available: "measured", offline: "pending", unknown: "pending" };

/** Paramètres › Version de l'application : version installée, état de mise à jour et bouton pour la recevoir. */
export function AppVersionSettings({ update }: { update: Update }) {
  const { status, latest, checkedAt, recheck, apply } = update;
  const message =
    status === "available" ? `Une nouvelle version${latest?.version && latest.version !== "dev" ? ` (${latest.version})` : ""} est disponible. Mettez à jour pour en profiter : l’application se recharge, vos données ne sont pas touchées.`
    : status === "current" ? "Vous utilisez la dernière version de Mon E‑Carnet."
    : status === "offline" ? "Vous êtes hors connexion : la recherche de mise à jour reprendra au retour du réseau."
    : status === "unknown" ? "La recherche de mise à jour n’a pas abouti. Réessayez dans un instant."
    : "Recherche d’une nouvelle version…";
  return (
    <div className="settings-modal-section">
      <span className="eyebrow">Version installée</span>
      <dl className="settings-details">
        <div><dt>Application</dt><dd translate="no">Mon E‑Carnet v{APP_VERSION}</dd></div>
        {APP_BUILD !== "dev" && <div><dt>Numéro de build</dt><dd translate="no"><code>{APP_BUILD}</code></dd></div>}
        <div><dt>État</dt><dd><span className={`badge ${BADGE[status]}`}>{UPDATE_LABELS[status]}</span></dd></div>
        {checkedAt && <div><dt>Dernière vérification</dt><dd>{checkedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</dd></div>}
      </dl>
      <p className="muted" role="status" aria-live="polite">{message}</p>
      <div className="actions">
        {status === "available" && <button type="button" className="button primary" onClick={() => void apply()}>Mettre à jour maintenant</button>}
        <button type="button" className={status === "available" ? "button" : "button primary"} onClick={recheck} disabled={status === "checking"}>Rechercher une mise à jour</button>
      </div>
    </div>
  );
}
