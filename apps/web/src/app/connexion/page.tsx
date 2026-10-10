import Link from "next/link";
import { AuthForms } from "../../components/AuthForms";
export const metadata = { title: "Connexion — Mon Carnet Numérique", robots: { index: false, follow: false } };
export default function LoginPage() {
  return <main className="auth-shell auth-shell--landing"><div className="auth-landing">
    <section className="auth-landing__copy"><p className="brand"><span className="brand-mark" aria-hidden="true">＋</span> Mon Carnet Numérique</p>
      <span className="eyebrow">Un carnet personnel, sous votre contrôle</span><h1>Votre santé, votre carnet, votre décision.</h1>
      <p className="muted">Un seul accès pour retrouver votre espace ou créer votre carnet. Vous gardez la maîtrise de vos données et de vos accès médicaux.</p>
      <div className="actions"><Link href="/" className="button">Accueil</Link></div>
    </section><div id="login" className="auth-landing__panel"><AuthForms /></div>
  </div></main>;
}
