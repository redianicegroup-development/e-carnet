import Link from "next/link";
import { IdentityOnboarding } from "../../../components/IdentityOnboarding";
export const metadata = { title: "Votre identité — Mon Carnet Numérique", robots: { index: false, follow: false } };
export default function IdentityPage() { return <main className="auth-shell"><Link className="button" href="/">← Accueil</Link><IdentityOnboarding /><p className="auth-switch">Étape suivante : choisir votre espace Patient ou Professionnel.</p></main>; }
