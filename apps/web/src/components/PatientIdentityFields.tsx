"use client";
import { useEffect, useState } from "react";
import { ApiError, apiGet, apiPatch, apiPost } from "../infrastructure/api/client";
import { ageLabel } from "../lib/age";

/* Couverture du carnet papier : ville, adresse (BP), profession, « délivré le ». Le nom et les prénoms sont saisis à l'étape 1 (identité) : ils ne sont pas redemandés ici.
   Obligatoire : la ville. Le reste est facultatif. Aucune donnée d'origine ethnique : sensible et sans utilité clinique ici.
   Ces champs servent à l'étape 3 d'un patient et, dans le même bloc, à l'étape 3 d'un professionnel (son carnet patient). */
export type PatientForm = {
  city: string;
  address: string;
  profession: string;
  phone: string;
  birth_date: string;
  gender: string;
  coverage_provider: string;
  coverage_number: string;
  coverage_expiry: string;
};
type PatientProfile = { created_at?: string; phone?: string; birth_date?: string | null; gender?: string; address?: string; profession?: string; coverage_provider?: string; coverage_number?: string; coverage_expiry?: string | null };
type Declaration = { kind: string; label: string };

export const EMPTY_PATIENT_FORM: PatientForm = { city: "", address: "", profession: "", phone: "", birth_date: "", gender: "", coverage_provider: "", coverage_number: "", coverage_expiry: "" };
const GENDER_OPTIONS = [{ value: "female", label: "Femme" }, { value: "male", label: "Homme" }, { value: "other", label: "Autre" }, { value: "prefer_not_to_say", label: "Je préfère ne pas préciser" }];
const DELIVERY_DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/** Formulaire du carnet patient. Les informations déjà connues (compte, profil, ville) préremplissent l'écran : un retour en arrière ne fait rien perdre.
    L'âge n'est jamais saisi à la main : il se déduit de la date de naissance (`ageLabel`) et reste donc juste dans le temps. */
export function usePatientIdentityForm() {
  const [form, setForm] = useState<PatientForm>(EMPTY_PATIENT_FORM);
  const [issuedAt, setIssuedAt] = useState<Date>(() => new Date());

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      apiGet<PatientProfile>("/api/v1/patient/profile/"),
      apiGet<Declaration[]>("/api/v1/patient/declarations/"),
    ]).then(([profile, declarations]) => {
      if (!active) return;
      setForm((current) => ({
        ...current,
        city: declarations.status === "fulfilled" ? declarations.value.find((item) => item.kind === "city")?.label ?? "" : current.city,
        phone: profile.status === "fulfilled" ? profile.value.phone ?? "" : current.phone,
        birth_date: profile.status === "fulfilled" ? profile.value.birth_date ?? "" : current.birth_date,
        gender: profile.status === "fulfilled" ? profile.value.gender ?? "" : current.gender,
        address: profile.status === "fulfilled" ? profile.value.address ?? "" : current.address,
        profession: profile.status === "fulfilled" ? profile.value.profession ?? "" : current.profession,
        coverage_provider: profile.status === "fulfilled" ? profile.value.coverage_provider ?? "" : current.coverage_provider,
        coverage_number: profile.status === "fulfilled" ? profile.value.coverage_number ?? "" : current.coverage_number,
        coverage_expiry: profile.status === "fulfilled" ? profile.value.coverage_expiry ?? "" : current.coverage_expiry,
      }));
      if (profile.status === "fulfilled" && profile.value.created_at) setIssuedAt(new Date(profile.value.created_at));
    });
    return () => { active = false; };
  }, []);

  function update(field: keyof PatientForm, value: string) { setForm((current) => ({ ...current, [field]: value })); }
  return { form, update, issuedAt };
}

/** Message à afficher si la ville manque ; chaîne vide si le carnet peut être enregistré. */
export function patientFormProblem(form: PatientForm): string {
  return form.city.trim() ? "" : "La ville est obligatoire.";
}

/** Enregistre le carnet patient (espace patient). Chaque appel est répétable sans risque : en cas d'échec au milieu, un nouvel essai reprend sans doublon. */
export async function savePatientIdentity(form: PatientForm) {
  await apiPost("/api/v1/patient/declarations/", { kind: "city", label: form.city.trim() });
  await apiPatch("/api/v1/identity/onboarding/patient/", {
    phone: form.phone.trim(),
    birth_date: form.birth_date || null,
    gender: form.gender,
    address: form.address.trim(),
    profession: form.profession.trim(),
    coverage_provider: form.coverage_provider.trim(),
    coverage_number: form.coverage_number.trim(),
    coverage_expiry: form.coverage_expiry || null,
  });
}

/** Message d'erreur lisible après un enregistrement raté : session expirée, service injoignable ou message de l'API. */
export function onboardingErrorMessage(error: unknown): string {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return "Connectez-vous à nouveau pour terminer votre onboarding.";
  return error instanceof Error ? error.message : "Impossible de joindre le service. Vérifiez votre connexion puis réessayez.";
}

/** Les champs du carnet patient (couverture du carnet papier, identité, âge et genre, couverture santé). À mettre dans un <form>. */
/** `showProfession` : faux pour un professionnel, dont la profession est déjà dans son bloc « espace professionnel ». */
export function PatientIdentityFields({ form, update, issuedAt, showProfession = true }: { form: PatientForm; update: (field: keyof PatientForm, value: string) => void; issuedAt: Date; showProfession?: boolean }) {
  return <>
    <div className="titulaire-cover" aria-label="Couverture du carnet">
      <strong>Carnet individuel de santé</strong>
      <span>Délivré le <time dateTime={issuedAt.toISOString()}>{DELIVERY_DATE.format(issuedAt)}</time></span>
    </div>
    <label className="field"><span>Ville</span><input required autoComplete="address-level2" maxLength={120} value={form.city} onChange={event => update("city", event.target.value)} /></label>
    <label className="field"><span>Adresse ou BP (facultatif)</span><input autoComplete="street-address" maxLength={240} value={form.address} onChange={event => update("address", event.target.value)} /></label>
    {showProfession && <label className="field"><span>Profession (facultatif)</span><input maxLength={120} value={form.profession} onChange={event => update("profession", event.target.value)} /></label>}
    <label className="field"><span>Téléphone (facultatif)</span><input autoComplete="tel" value={form.phone} onChange={event => update("phone", event.target.value)} /></label>
    <fieldset className="onboarding-age-gender">
      <legend>Âge et genre (facultatifs)</legend>
      <label className="field"><span>Date de naissance</span><input type="date" max={new Date().toISOString().slice(0, 10)} value={form.birth_date} onChange={event => update("birth_date", event.target.value)} /></label>
      <p className="onboarding-age-gender__age" role="status" aria-live="polite"><span>Âge</span><strong>{ageLabel(form.birth_date) || "calculé à partir de la date de naissance"}</strong></p>
      <label className="field"><span>Genre</span><select value={form.gender} onChange={event => update("gender", event.target.value)}><option value="">Non précisé</option>{GENDER_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    </fieldset>
    <h2>Couverture (facultative)</h2>
    <label className="field"><span>Organisme</span><input value={form.coverage_provider} onChange={event => update("coverage_provider", event.target.value)} /></label>
    <label className="field"><span>Numéro</span><input value={form.coverage_number} onChange={event => update("coverage_number", event.target.value)} /></label>
    <label className="field"><span>Date d’expiration</span><input type="date" value={form.coverage_expiry} onChange={event => update("coverage_expiry", event.target.value)} /></label>
  </>;
}
