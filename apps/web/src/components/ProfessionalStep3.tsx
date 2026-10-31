"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPatch, apiPost } from "../infrastructure/api/client";
import { OnboardingNav } from "./onboarding/OnboardingChrome";
import { PatientIdentityFields, onboardingErrorMessage, patientFormProblem, savePatientIdentity, usePatientIdentityForm } from "./PatientIdentityFields";
import { SPECIALTY_REQUIRED_MESSAGE, SpecialtyFields, useSpecialtyChoice } from "./ProfessionalOnboarding";
import { CredentialFields, useCredentialsDraft, type Credentials } from "./ProfessionalCredentialsSettings";
import "./ink-capture.css";

/* Le profil professionnel n'existe pas encore à la première visite : la saisie d'ordonnance démarre vide. Au retour sur l'étape, ce qui est déjà enregistré revient. */
const NO_CREDENTIALS: Credentials = { professional_identifier: "", stamp_uploaded: false, signature_uploaded: false };

/** Étape 3 d'un professionnel, en un seul bloc : son carnet patient (espace patient) et son profil professionnel (espace professionnel), enregistrés ensemble.
    Un seul compte, deux espaces : le carnet patient d'abord, puis l'espace professionnel est activé. Ensuite : étape 4, la sécurité du compte. */
export function ProfessionalStep3() {
  const router = useRouter();
  const { form, update, issuedAt } = usePatientIdentityForm();
  const choice = useSpecialtyChoice();
  const [credentials, setCredentials] = useState<Credentials>(NO_CREDENTIALS);
  const draft = useCredentialsDraft(credentials, setCredentials);
  const { setIdentifier } = draft;
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    apiGet<Credentials>("/api/v1/professionals/credentials/")
      .then((loaded) => {
        if (!active) return;
        setCredentials(loaded);
        setIdentifier((current) => current || loaded.professional_identifier || "");
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [setIdentifier]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = patientFormProblem(form);
    if (problem) { setMessage(problem); return; }
    if (!choice.valid) { setMessage(SPECIALTY_REQUIRED_MESSAGE); return; }
    setSubmitting(true);
    setMessage("Enregistrement…");
    try {
      // Chaque appel est répétable sans risque : en cas d'échec au milieu, un nouvel essai reprend sans doublon.
      await savePatientIdentity(form); // espace patient (contexte patient actif depuis l'étape 2)
      await apiPost("/api/v1/identity/contexts/select/", { role: "professional" }); // le carnet patient est prêt : on active l'espace professionnel
      await apiPatch("/api/v1/professionals/onboarding/", { specialty: choice.value }); // espace professionnel
      if (draft.changed) await draft.upload(); // numéro d'ordre, cachet, signature (facultatifs)
      router.push("/onboarding/securite");
    } catch (error) {
      setMessage(onboardingErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return <form className="card auth-form" onSubmit={submit}>
    <span className="eyebrow">Étape 3 · votre profil</span>
    <h1>Complétez votre profil.</h1>
    <p className="muted">Un seul compte, deux espaces. Seules la ville et la spécialité sont obligatoires ; votre nom et vos prénoms viennent de l’étape 1.</p>
    <p className="notice" role="note">Utilisez des informations exactes et gardez votre compte personnel.</p>

    <fieldset className="onboarding-part">
      <legend>Dans votre espace patient</legend>
      <PatientIdentityFields form={form} update={update} issuedAt={issuedAt} showProfession={false} />
    </fieldset>

    <fieldset className="onboarding-part">
      <legend>Dans votre espace professionnel</legend>
      <p className="muted">Le numéro d’ordre, le cachet et la signature sont facultatifs : vous pourrez les ajouter plus tard dans vos paramètres.</p>
      <SpecialtyFields choice={choice} disabled={submitting} />
      <CredentialFields draft={draft} profile={credentials} />
    </fieldset>

    <OnboardingNav backHref="/onboarding?role=professional" busy={submitting || draft.busy} disabled={!choice.specialties} />
    <p className="status" role="status" aria-live="polite">{message || draft.message || choice.loadMessage}</p>
  </form>;
}
