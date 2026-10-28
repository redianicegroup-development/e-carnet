import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "../ui/BrandLogo";
import { OnboardingProgress } from "./OnboardingProgress";
import "./onboarding.css";

/** Cadre des étapes d'inscription : le logo (retour au site) en haut. Les boutons Retour et Suivant sont en bas de chaque étape (<OnboardingNav />). */
export function OnboardingFrame({ children }: { children: ReactNode }) {
  return <main className="auth-shell onboarding-frame">
    <Link className="onboarding-logo" href="/" aria-label="Mon E‑Carnet : retour à l’accueil du site"><BrandLogo height={40} /></Link>
    <OnboardingProgress />
    {children}
  </main>;
}

/** Retour / Suivant, en bas de chaque étape. Dans un formulaire, « Suivant » enregistre puis passe à l'étape d'après. */
export function OnboardingNav({ backHref, nextLabel = "Suivant", busy = false, disabled = false, type = "submit", onNext }: { backHref: string; nextLabel?: string; busy?: boolean; disabled?: boolean; type?: "submit" | "button"; onNext?: () => void }) {
  return <div className="onboarding-nav">
    <Link className="button" href={backHref}>Retour</Link>
    <button className="button primary" type={type} disabled={busy || disabled} onClick={type === "button" ? onNext : undefined}>{busy ? "Enregistrement…" : nextLabel}</button>
  </div>;
}
