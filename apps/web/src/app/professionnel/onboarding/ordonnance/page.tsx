import Link from "next/link";
import { ProfessionalCredentialsOnboarding } from "../../../../components/ProfessionalCredentialsOnboarding";

export const metadata = { title: "Cachet et signature — Mon E-Carnet", robots: { index: false, follow: false } };

/* `?etape=3` : partie 3 sur 3 de l'étape 3 d'un professionnel qui s'inscrit (après son carnet patient et son profil). Ensuite : étape 4, la sécurité du compte. */
export default async function ProfessionalCredentialsOnboardingPage({ searchParams }: { searchParams: Promise<{ etape?: string }> }) {
  const { etape } = await searchParams;
  const step3 = etape === "3";
  return <div className="stack-lg"><Link className="button" href={step3 ? "/professionnel/onboarding?etape=3" : "/professionnel/onboarding"}>← Mon profil</Link><ProfessionalCredentialsOnboarding step3={step3} /></div>;
}
