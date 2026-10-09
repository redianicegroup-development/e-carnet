import Link from "next/link";
import { AuthForms } from "../../components/AuthForms";
export const metadata = { title: "Créer un compte — Mon Carnet Numérique", robots: { index: false, follow: false } };
export default function RegisterPage() { return <main className="auth-shell"><Link className="button" href="/">← Accueil</Link><AuthForms mode="register" /><p className="auth-switch">Vous avez déjà un compte ? <Link href="/connexion">Se connecter</Link></p></main>; }
