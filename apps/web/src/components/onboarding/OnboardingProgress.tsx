"use client";

import { usePathname } from "next/navigation";

/* Étape courante d'après l'adresse : 1 identité, 2 espace, 3 carnet (ou profil professionnel), 4 sécurité (ou cachet et signature). */
const STEPS: Record<string, number> = {
  "/onboarding/identite": 1,
  "/onboarding": 2,
  "/onboarding/patient": 3,
  "/onboarding/securite": 4,
  "/professionnel/onboarding": 3,
  "/professionnel/onboarding/ordonnance": 4,
};

export function OnboardingProgress() {
  const step = STEPS[(usePathname() ?? "").replace(/\/$/, "")];
  if (!step) return null;
  return <div className="progress-bars" role="img" aria-label={`Étape ${step} sur 4`}>{[1, 2, 3, 4].map((n) => <i key={n} className={n <= step ? "is-done" : undefined} />)}</div>;
}
