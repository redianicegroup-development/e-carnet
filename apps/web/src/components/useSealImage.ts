"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../infrastructure/api/client";

export type SealKind = "stamp" | "signature";

/** Aperçu du cachet ou de la signature déjà enregistrés. L'image est privée : elle est lue par le serveur pour son propriétaire seulement.
    `refreshKey` change après un dépôt ou un retrait pour relire l'image. Renvoie une URL d'objet (révoquée au démontage) ou "". */
export function useSealImage(kind: SealKind, enabled: boolean, refreshKey: number | string = 0) {
  const [loaded, setLoaded] = useState<{ key: string; url: string }>({ key: "", url: "" });
  const key = `${kind}:${refreshKey}`;
  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    let objectUrl = "";
    fetch(`${API_URL}/api/v1/professionals/credentials/${kind}/`, { credentials: "include", cache: "no-store" })
      .then((response) => (response.ok ? response.blob() : Promise.reject(new Error("unavailable"))))
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setLoaded({ key, url: objectUrl });
      })
      .catch(() => { if (active) setLoaded({ key, url: "" }); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [kind, enabled, key]);
  return enabled && loaded.key === key ? loaded.url : "";
}
