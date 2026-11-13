"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { DATA_SAVER_EVENT, DATA_SAVER_KEY, SERVER_SNAPSHOT, dataSaverReason, decodeSnapshot, encodeSnapshot, isDataSaverActive, parseDataSaverSetting, type ConnectionInfo, type DataSaverSetting } from "../../lib/data-saver";

/* Lecture réactive du mode économie de données : réglage enregistré sur l'appareil + état de la connexion.
   Seul le CHOIX du patient (« automatique », « toujours », « jamais ») est conservé dans le navigateur : aucune donnée de santé. */

type NavigatorWithConnection = Navigator & { connection?: ConnectionInfo & EventTarget };

function connection(): (ConnectionInfo & EventTarget) | undefined {
  return typeof navigator === "undefined" ? undefined : (navigator as NavigatorWithConnection).connection;
}

function readSetting(): DataSaverSetting {
  try { return parseDataSaverSetting(window.localStorage.getItem(DATA_SAVER_KEY)); } catch { return "auto"; }
}

function snapshot(): string {
  return encodeSnapshot(readSetting(), connection());
}

function subscribe(onChange: () => void): () => void {
  const link = connection();
  window.addEventListener("storage", onChange);
  window.addEventListener(DATA_SAVER_EVENT, onChange);
  link?.addEventListener?.("change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(DATA_SAVER_EVENT, onChange);
    link?.removeEventListener?.("change", onChange);
  };
}

export function useDataSaver() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => SERVER_SNAPSHOT);
  const state = useMemo(() => {
    const { setting, info } = decodeSnapshot(raw);
    return { setting, active: isDataSaverActive(setting, info), reason: dataSaverReason(setting, info) };
  }, [raw]);
  const setSetting = useCallback((next: DataSaverSetting) => {
    try { window.localStorage.setItem(DATA_SAVER_KEY, next); } catch { /* stockage refusé : le choix ne sera pas gardé, rien d'autre ne change */ }
    window.dispatchEvent(new Event(DATA_SAVER_EVENT));
  }, []);
  return { ...state, setSetting };
}
