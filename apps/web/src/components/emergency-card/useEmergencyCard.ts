"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../../infrastructure/api/client";
import { isProfessionalAccount } from "../../lib/spaces";
import type { SpaceAccount } from "../shell/SpaceShell";
import type { EmergencyCardProfession, EmergencyCardView } from "./EmergencyCardVisual";

/** Ce que renvoie `/api/v1/patient/emergency-card/` : la carte, plus l'état de son QR public. */
export type EmergencyCardData = EmergencyCardView & { qr_enabled: boolean; qr_token: string; updated_at?: string };

export const EMPTY_CARD_DATA: EmergencyCardData = {
  first_name: "", last_name: "", city: "", blood_group: "", height_cm: "", weight_kg: "",
  allergies: [], treatments: [], contact_name: "", contact_phone: "", qr_enabled: false, qr_token: "",
};

/** Charge la carte virtuelle du compte (la même depuis l'espace patient et l'espace professionnel). */
export function useEmergencyCard() {
  const [card, setCard] = useState<EmergencyCardData>(EMPTY_CARD_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    apiGet<EmergencyCardData>("/api/v1/patient/emergency-card/")
      .then((data) => { if (active) setCard(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Carte indisponible."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return { card, setCard, loading, error };
}

/** Métier déclaré du compte ; `null` pour un patient simple (pas de profil professionnel, aucun appel inutile). */
export function useOwnProfession(account: SpaceAccount | null): EmergencyCardProfession | null {
  const [profession, setProfession] = useState<EmergencyCardProfession | null>(null);
  const isProfessional = account ? isProfessionalAccount(account.contexts) : false;
  useEffect(() => {
    if (!isProfessional) return;
    let active = true;
    apiGet<{ professional_title?: string; specialty?: string }>("/api/v1/professionals/me/")
      .then((profile) => { if (active && profile.professional_title) setProfession({ title: profile.professional_title, specialty: profile.specialty || undefined }); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [isProfessional]);
  return isProfessional ? profession : null;
}
