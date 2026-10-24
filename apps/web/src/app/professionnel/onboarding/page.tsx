import Link from "next/link";
import { ProfessionalOnboarding } from "../../../components/ProfessionalOnboarding";

export const metadata = { title: "Profil professionnel — Mon E-Carnet", robots: { index: false, follow: false } };

/* `?retour=parametres` : le médecin modifie son profil depuis ses paramètres ; il y revient après l'enregistrement
   (sans repasser par l'étape cachet et signature, réservée à la première configuration). */
export default async function ProfessionalOnboardingPage({ searchParams }: { searchParams: Promise<{ retour?: string; etape?: string }> }) {
  const { retour, etape } = await searchParams;
  const fromSettings = retour === "parametres";
  const step3 = etape === "3" && !fromSettings;
  return <div className="stack-lg"><Link className="button" href={step3 ? "/onboarding/patient?suite=professionnel" : fromSettings ? "/professionnel/parametres" : "/professionnel"}>{step3 ? "← Mon carnet patient" : fromSettings ? "← Paramètres" : "← Espace professionnel"}</Link><ProfessionalOnboarding returnTo={fromSettings ? "/professionnel/parametres" : undefined} step3={step3} /></div>;
}
