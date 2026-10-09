import Link from "next/link";
import { AuthForms } from "../../components/AuthForms";

export const metadata = { title: "Connexion — Mon Carnet Numérique", robots: { index: false, follow: false } };

export default function LoginPage() {
  return (
    <main className="auth-shell auth-shell--landing">
      <div className="auth-landing">
        <section className="auth-landing__copy">
          <p className="brand">
            <span className="brand-mark" aria-hidden="true">＋</span>
            Mon Carnet Numérique
          </p>
          <span className="eyebrow">Un carnet personnel, sous votre contrôle</span>
          <h1>Votre santé, votre carnet, votre décision.</h1>
          <p className="muted">
            Accédez à votre espace, gardez la maîtrise de vos données et gérez vos accès médicaux avec clarté.
          </p>
          <div className="actions">
            <a href="#login" className="button primary">Se connecter</a>
            <Link href="/" className="button">Accueil</Link>
          </div>
        </section>

        <div id="login" className="auth-landing__panel">
          <AuthForms mode="login" />
        </div>
      </div>
    </main>
  );
}
