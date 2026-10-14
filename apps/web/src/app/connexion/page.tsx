import Link from "next/link";
import { AuthForms } from "../../components/AuthForms";
import { AuthUiProvider } from "../../components/auth/AuthUiContext";
import { AuthWelcome } from "../../components/auth/AuthWelcome";
import { AuthMotion } from "../../components/motion/AuthMotion";
import { PulseLine } from "../../components/motion/PulseLine";
import { BrandMark } from "../../components/ui/BrandMark";
import "./auth-immersive.css";

export const metadata = { title: "Connexion — Mon Carnet Numérique", robots: { index: false, follow: false } };

/* Grand écran : un cadre à deux volets (scène animée à gauche, formulaire à droite).
   Mobile : un écran d'accueil (personnage, boutons) puis le formulaire e‑mail, comme une application. */
export default function LoginPage() {
  return <AuthUiProvider><AuthMotion><main className="auth-shell auth-shell--immersive"><div className="ax-frame">
    <section className="ax-stage" aria-labelledby="auth-title">
      <span className="ax-blob ax-blob--a" aria-hidden="true" />
      <span className="ax-blob ax-blob--b" aria-hidden="true" />
      <span className="ax-blob ax-blob--c" aria-hidden="true" />
      <PulseLine className="ax-stage__pulse" />
      <p className="ax-brand" data-auth-item><BrandMark /> <span>Mon Carnet Numérique</span></p>
      <AuthWelcome />
      <div className="ax-stage__copy">
        <p className="ax-stage__eyebrow" data-auth-item>Votre carnet, simplement</p>
        <h1 id="auth-title">Votre santé, votre carnet, votre décision.</h1>
        <p className="ax-stage__lead" data-auth-item><span className="ax-lead-long">Un seul accès pour retrouver votre espace ou créer votre carnet. Vous gardez la maîtrise de vos données et de vos accès médicaux.</span><span className="ax-lead-short">Un seul accès à votre carnet. Vous gardez la main sur vos données.</span></p>
        <Link href="/" className="ax-stage__home" data-auth-item>← Retour à l’accueil</Link>
      </div>
    </section>
    <div id="login" className="ax-panel">
      <AuthForms />
      <nav className="auth-legal-links" aria-label="Informations légales"><Link href="/mentions-legales">Mentions légales</Link><Link href="/confidentialite">Confidentialité</Link><Link href="/cgu">Conditions d’utilisation</Link><Link href="/faq">Aide</Link><Link href="/credits">Crédits</Link></nav>
    </div>
  </div></main></AuthMotion></AuthUiProvider>;
}
