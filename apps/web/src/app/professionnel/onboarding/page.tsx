import { redirect } from "next/navigation";
import { ProfessionalOnboarding } from "../../../components/ProfessionalOnboarding";
import { OnboardingFrame } from "../../../components/onboarding/OnboardingChrome";

export const metadata = { title: "Profil professionnel — Mon E-Carnet", robots: { index: false, follow: false } };

/* `?retour=parametres` : le médecin modifie son profil depuis ses paramètres ; il y revient après l'enregistrement
   (sans repasser par l'étape cachet et signature, réservée à la première configuration). Le logo du bandeau ramène au site.
   `?etape=3` : ancien lien de l'étape 3, désormais un seul bloc dans /onboarding/patient?suite=professionnel. */
export default async function ProfessionalOnboardingPage({ searchParams }: { searchParams: Promise<{ retour?: string; etape?: string }> }) {
  const { retour, etape } = await searchParams;
  const fromSettings = retour === "parametres";
  if (etape === "3" && !fromSettings) redirect("/onboarding/patient?suite=professionnel");
  const backHref = fromSettings ? "/professionnel/parametres" : "/professionnel";
  return <OnboardingFrame><ProfessionalOnboarding returnTo={fromSettings ? "/professionnel/parametres" : undefined} backHref={backHref} /></OnboardingFrame>;
}
