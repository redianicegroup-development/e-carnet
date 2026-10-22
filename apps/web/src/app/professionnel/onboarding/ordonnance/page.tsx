import Link from "next/link";
import { ProfessionalCredentialsOnboarding } from "../../../../components/ProfessionalCredentialsOnboarding";

export const metadata = { title: "Cachet et signature — Mon E-Carnet", robots: { index: false, follow: false } };

export default function ProfessionalCredentialsOnboardingPage() {
  return <div className="stack-lg"><Link className="button" href="/professionnel/onboarding">← Mon profil</Link><ProfessionalCredentialsOnboarding /></div>;
}
