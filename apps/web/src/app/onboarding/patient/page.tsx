import Link from "next/link";
import { PatientOnboarding } from "../../../components/PatientOnboarding";
export const metadata = { title: "Votre profil patient — Mon Carnet Numérique", robots: { index: false, follow: false } };
export default function OnboardingPatientPage() { return <main className="auth-shell"><Link className="button" href="/">← Accueil</Link><PatientOnboarding /><p className="auth-switch">Ces informations sont modifiables depuis votre espace.</p></main>; }
