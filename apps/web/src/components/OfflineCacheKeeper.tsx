"use client";

import { useEffect } from "react";
import { trimOfflineCache } from "../lib/offline-cache";
import { NETWORK_RESTORED_EVENT } from "../lib/network-status";
import { routesToWarm } from "../lib/offline-routes";
import { purgeOfflineSnapshot } from "../lib/offline-snapshot";
import { warmOfflineShells } from "../lib/offline-warmup";
import type { SpaceId } from "../lib/spaces";

const SETTLE_MS = 3000;

/** Sans rendu : entretient la copie hors connexion pendant qu'un espace est ouvert en ligne (tous les espaces). */
export function OfflineCacheKeeper({ space }: { space: SpaceId }) {
  useEffect(() => {
    void purgeOfflineSnapshot(); // l'ancienne copie en clair des déclarations n'est plus écrite : on l'efface
    void trimOfflineCache();
    const warm = () => { void warmOfflineShells(routesToWarm(space)); };
    const warmNow = () => { void warmOfflineShells(routesToWarm(space), true); };
    const timer = window.setTimeout(warm, SETTLE_MS);
    window.addEventListener(NETWORK_RESTORED_EVENT, warmNow);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(NETWORK_RESTORED_EVENT, warmNow);
    };
  }, [space]);
  return null;
}
