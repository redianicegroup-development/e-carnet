"use client";

import { useEffect } from "react";
import { DATA_SAVER_BANNER_TEXT, DATA_SAVER_SLOW_TITLE } from "../../lib/data-saver";
import { Icon } from "../ui/Icon";
import { useDataSaver } from "./useDataSaver";
import "./data-saver.css";

/* Tous les espaces (patient, professionnel, établissement, laboratoire, administration) : pose `data-data-saver="on"` sur <html>
   (CSS : polices du téléphone, pas d'animations) et affiche le bandeau « Mauvaise connexion, mode économie activé ».
   Le mode suit la connexion tout seul : il s'active quand le réseau est lent et se désactive dès qu'il redevient bon (réglage « Automatique »).
   Le bandeau n'a aucun bouton qui touche à la sécurité : le choix Automatique / Toujours / Jamais se trouve dans Paramètres › Économie de données.
   `visible={false}` : pages sans coque (le mode s'applique, mais aucun bandeau n'est dessiné). */
export function DataSaverBanner({ visible = true }: { visible?: boolean }) {
  const { active, reason, title } = useDataSaver();

  useEffect(() => {
    const root = document.documentElement;
    if (active) root.setAttribute("data-data-saver", "on"); else root.removeAttribute("data-data-saver");
    return () => root.removeAttribute("data-data-saver");
  }, [active]);

  if (!active || !visible) return null;
  const slow = title === DATA_SAVER_SLOW_TITLE;
  return <div className={`data-saver-banner${slow ? " data-saver-banner--slow" : ""}`} role="status" aria-live="polite">
    <span className="data-saver-banner__icon" aria-hidden="true"><Icon name={slow ? "signal" : "sliders"} size={22} /></span>
    <span className="data-saver-banner__body">
      <strong>{title}</strong>
      <small>{slow ? DATA_SAVER_BANNER_TEXT : `${reason} ${DATA_SAVER_BANNER_TEXT}`}</small>
    </span>
  </div>;
}
