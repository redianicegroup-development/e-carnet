import Link from "next/link";
import { PatientOnboarding } from "../../../components/PatientOnboarding";
export const metadata = { title: "Votre profil patient — Mon E-Carnet", robots: { index: false, follow: false } };

/* `?suite=professionnel` : le professionnel remplit d'abord son carnet patient (un seul compte, deux espaces), puis son profil professionnel. */
export default async function OnboardingPatientPage({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  const { suite } = await searchParams;
  const forProfessional = suite === "professionnel";
  return <main className="auth-shell"><Link className="button" href={forProfessional ? "/onboarding" : "/"}>{forProfessional ? "← Mon espace" : "← Accueil"}</Link><PatientOnboarding forProfessional={forProfessional} /><p className="auth-switch">Ces informations sont modifiables depuis votre espace.</p></main>;
}
