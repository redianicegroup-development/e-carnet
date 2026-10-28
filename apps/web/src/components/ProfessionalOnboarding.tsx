"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPatch } from "../infrastructure/api/client";
import { OnboardingNav } from "./onboarding/OnboardingChrome";

type Profile = { specialty: string };
const OTHER_SPECIALTY = "__other__";

/** Choix de la spécialité (liste partagée + « Autre ») : commun à « Profil professionnel » et à l'étape 3 de l'inscription d'un professionnel. */
export function useSpecialtyChoice() {
  const [specialties, setSpecialties] = useState<string[] | null>(null);
  const [selected, setSelected] = useState("");
  const [other, setOther] = useState("");
  const [loadMessage, setLoadMessage] = useState("Chargement des spécialités…");
  const isOther = selected === OTHER_SPECIALTY;
  const value = (isOther ? other : selected).trim();

  useEffect(() => {
    let active = true;
    Promise.all([
      apiGet<string[]>("/api/v1/professionals/specialties/"),
      apiGet<Profile>("/api/v1/professionals/me/").catch(() => null),
    ]).then(([options, profile]) => {
      if (!active) return;
      setSpecialties(options);
      if (profile?.specialty) setSelected(profile.specialty);
      setLoadMessage("");
    }).catch((error) => {
      if (active) setLoadMessage(error instanceof Error ? error.message : "Impossible de charger les spécialités.");
    });
    return () => { active = false; };
  }, []);

  return { specialties, selected, setSelected, other, setOther, isOther, value, valid: Boolean(value) && value !== OTHER_SPECIALTY, loadMessage };
}
export type SpecialtyChoice = ReturnType<typeof useSpecialtyChoice>;
export const SPECIALTY_REQUIRED_MESSAGE = "Choisissez une spécialité ou saisissez votre rôle dans « Autre ».";

/** Profession (médecin) et spécialité déclarée. À mettre dans un <form>. */
export function SpecialtyFields({ choice, disabled = false }: { choice: SpecialtyChoice; disabled?: boolean }) {
  return <>
    <label className="field">
      <span>Profession</span>
      <select value="Médecin" disabled aria-label="Profession">
        <option value="Médecin">Médecin</option>
      </select>
    </label>

    <label className="field">
      <span>Spécialité / rôle déclaré</span>
      <select required value={choice.selected} onChange={(event) => choice.setSelected(event.target.value)} disabled={!choice.specialties || disabled}>
        <option value="" disabled>Choisir une spécialité</option>
        {(choice.specialties ?? []).map((specialty) => <option key={specialty} value={specialty}>{specialty}</option>)}
        <option value={OTHER_SPECIALTY}>Autre — ajouter une spécialité</option>
      </select>
    </label>

    {choice.isOther && <label className="field">
      <span>Nouvelle spécialité / rôle</span>
      <input required maxLength={120} value={choice.other} onChange={(event) => choice.setOther(event.target.value)} placeholder="Ex. Pédiatre" disabled={disabled} />
      <small className="muted">Cette option sera ajoutée à la liste.</small>
    </label>}
  </>;
}

/** Profil professionnel hors inscription : depuis « Compléter mon profil » (accueil) ou « Modifier mon profil » (paramètres, `returnTo`).
    À la première inscription, la spécialité se déclare dans le bloc unique de l'étape 3 (ProfessionalStep3). */
export function ProfessionalOnboarding({ returnTo, backHref = "/professionnel" }: { returnTo?: string; backHref?: string }) {
  const router = useRouter();
  const choice = useSpecialtyChoice();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!choice.valid) {
      setMessage(SPECIALTY_REQUIRED_MESSAGE);
      return;
    }
    setBusy(true);
    setMessage("Enregistrement du profil…");
    try {
      await apiPatch("/api/v1/professionals/onboarding/", { specialty: choice.value });
      setMessage("Spécialité enregistrée.");
      router.push(returnTo ?? "/professionnel/onboarding/ordonnance");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Le profil n’a pas pu être enregistré.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card auth-form" onSubmit={submit}>
      <span className="eyebrow">Profil professionnel</span>
      <h1>Votre profil professionnel.</h1>
      <p className="muted">Les informations patient sont conservées dans votre espace patient. Ce bloc contient uniquement votre métier et votre spécialité pour l’espace professionnel.</p>
      <SpecialtyFields choice={choice} disabled={busy} />
      <OnboardingNav backHref={backHref} nextLabel="Enregistrer" busy={busy} disabled={!choice.specialties} />
      <p className="status" role="status" aria-live="polite">{message || choice.loadMessage}</p>
    </form>
  );
}
