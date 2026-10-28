import { redirect } from "next/navigation";
import { ProfessionalCredentialsOnboarding } from "../../../../components/ProfessionalCredentialsOnboarding";
import { OnboardingFrame } from "../../../../components/onboarding/OnboardingChrome";

export const metadata = { title: "Cachet et signature — Mon E-Carnet", robots: { index: false, follow: false } };

/* Étape facultative après « Compléter mon profil ». `?etape=3` : ancien lien de l'étape 3, désormais un seul bloc dans /onboarding/patient?suite=professionnel. */
export default async function ProfessionalCredentialsOnboardingPage({ searchParams }: { searchParams: Promise<{ etape?: string }> }) {
  const { etape } = await searchParams;
  if (etape === "3") redirect("/onboarding/patient?suite=professionnel");
  return <OnboardingFrame><ProfessionalCredentialsOnboarding backHref="/professionnel/onboarding" /></OnboardingFrame>;
}
