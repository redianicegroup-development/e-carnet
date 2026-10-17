import Link from "next/link";
import { ProfessionalOnboarding } from "../../../components/ProfessionalOnboarding";

export const metadata = { title: "Profil professionnel — Mon E-Carnet", robots: { index: false, follow: false } };

export default function ProfessionalOnboardingPage() {
  return <div className="stack-lg"><Link className="button" href="/professionnel">← Espace professionnel</Link><ProfessionalOnboarding /></div>;
}
