"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingNav } from "./onboarding/OnboardingChrome";
import { PatientIdentityFields, onboardingErrorMessage, patientFormProblem, savePatientIdentity, usePatientIdentityForm } from "./PatientIdentityFields";

/** Étape 3 d'un patient : son carnet (les champs sont dans PatientIdentityFields, communs avec l'étape 3 d'un professionnel). Puis étape 4 : la sécurité du compte. */
export function PatientOnboarding() {
  const router = useRouter();
  const { form, update, issuedAt } = usePatientIdentityForm();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = patientFormProblem(form);
    if (problem) { setMessage(problem); return; }
    setSubmitting(true);
    setMessage("Enregistrement…");
    try {
      await savePatientIdentity(form);
      router.push("/onboarding/securite");
    } catch (error) {
      setMessage(onboardingErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return <form className="card auth-form" onSubmit={submit}>
    <span className="eyebrow">Étape 3 · identité du titulaire</span>
    <h1>Ouvrir votre carnet.</h1>
    <p className="muted">Comme sur la couverture du carnet papier. Seuls le nom, les prénoms et la ville sont obligatoires.</p>
    <p className="notice" role="note">Utilisez des informations exactes et gardez votre compte personnel.</p>
    <PatientIdentityFields form={form} update={update} issuedAt={issuedAt} />
    <OnboardingNav backHref="/onboarding?role=patient" busy={submitting} />
    <p className="status" role="status">{message}</p>
  </form>;
}
