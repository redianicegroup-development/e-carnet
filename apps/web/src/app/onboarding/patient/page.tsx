import { PatientOnboarding } from "../../../components/PatientOnboarding";
import { ProfessionalStep3 } from "../../../components/ProfessionalStep3";
import { OnboardingFrame } from "../../../components/onboarding/OnboardingChrome";
export const metadata = { title: "Votre profil — Mon E-Carnet", robots: { index: false, follow: false } };

/* Étape 3. `?suite=professionnel` : le professionnel remplit en un seul bloc son carnet patient (espace patient) et son profil professionnel (espace professionnel). */
export default async function OnboardingPatientPage({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  const { suite } = await searchParams;
  return <OnboardingFrame>{suite === "professionnel" ? <ProfessionalStep3 /> : <PatientOnboarding />}</OnboardingFrame>;
}
