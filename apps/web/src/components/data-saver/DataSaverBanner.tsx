"use client";

import { useEffect } from "react";
import { DATA_SAVER_BANNER_TEXT, DATA_SAVER_BANNER_TITLE } from "../../lib/data-saver";
import { useDataSaver } from "./useDataSaver";
import "./data-saver.css";

/* Espace patient : pose `data-data-saver="on"` sur <html> (CSS : polices du téléphone, pas d'animations) et affiche le bandeau d'information.
   Le bandeau n'a aucun bouton qui touche à la sécurité : le réglage se trouve dans Paramètres › Économie de données. */
export function DataSaverBanner() {
  const { active, reason } = useDataSaver();

  useEffect(() => {
    const root = document.documentElement;
    if (active) root.setAttribute("data-data-saver", "on"); else root.removeAttribute("data-data-saver");
    return () => root.removeAttribute("data-data-saver");
  }, [active]);

  if (!active) return null;
  return <div className="data-saver-banner" role="status"><strong>{DATA_SAVER_BANNER_TITLE}</strong> <span>{reason} {DATA_SAVER_BANNER_TEXT}</span></div>;
}
