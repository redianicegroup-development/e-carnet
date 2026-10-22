import Link from "next/link";
import { ProfessionalOnboarding } from "../../../components/ProfessionalOnboarding";

export const metadata = { title: "Profil professionnel — Mon E-Carnet", robots: { index: false, follow: false } };

/* `?retour=parametres` : le médecin modifie son profil depuis ses paramètres ; il y revient après l'enregistrement
   (sans repasser par l'étape cachet et signature, réservée à la première configuration). */
export default async function ProfessionalOnboardingPage({ searchParams }: { searchParams: Promise<{ retour?: string }> }) {
  const { retour } = await searchParams;
  const fromSettings = retour === "parametres";
  return <div className="stack-lg"><Link className="button" href={fromSettings ? "/professionnel/parametres" : "/professionnel"}>{fromSettings ? "← Paramètres" : "← Espace professionnel"}</Link><ProfessionalOnboarding returnTo={fromSettings ? "/professionnel/parametres" : undefined} /></div>;
}
