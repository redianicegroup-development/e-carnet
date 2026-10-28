import { OnboardingFrame } from "../../components/onboarding/OnboardingChrome";
import { RoleChoice } from "../../components/RoleChoice";

export const metadata = { title: "Votre espace — Mon E-Carnet", robots: { index: false, follow: false } };

/* `?role=` : au retour depuis l'étape 3, le choix déjà fait reste sélectionné. */
export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams;
  return <OnboardingFrame><RoleChoice initialRole={role === "professional" ? "professional" : role === "patient" ? "patient" : undefined} /></OnboardingFrame>;
}
