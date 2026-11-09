"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiPost } from "../infrastructure/api/client";
import { cleanUpBeforeLogout } from "../lib/logout";

/** SEC-04 : « Se déconnecter de tous les appareils ». Ferme toutes les sessions du compte, celle-ci comprise, puis revient à la connexion. */
export function useLogoutAll(onError: (message: string) => void) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function logoutAll() {
    setBusy(true);
    try {
      await cleanUpBeforeLogout(); // push + copies locales, tant que la session existe
      await apiPost("/api/v1/identity/logout-all/");
      router.push("/connexion");
      router.refresh();
    } catch (error) {
      onError(error instanceof Error ? error.message : "La déconnexion de tous les appareils n’a pas abouti.");
      setBusy(false);
    }
  }
  return { logoutAll, busy };
}
