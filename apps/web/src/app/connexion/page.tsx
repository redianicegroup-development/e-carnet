import Link from "next/link";
import { AuthForms } from "../../components/AuthForms";
import { AuthMotion } from "../../components/motion/AuthMotion";
import { PulseLine } from "../../components/motion/PulseLine";
import { BrandMark } from "../../components/ui/BrandMark";
import { Icon } from "../../components/ui/Icon";
import "./auth-immersive.css";

export const metadata = { title: "Connexion — Mon Carnet Numérique", robots: { index: false, follow: false } };

const REASSURANCES = [
  { icon: "lock", text: "Chaque accès à votre carnet nécessite votre accord." },
  { icon: "eye", text: "Vous retrouvez les demandes et l’historique des accès." },
  { icon: "shield", text: "Utilisez uniquement des données fictives pour le moment." },
] as const;

export default function LoginPage() {
  return <AuthMotion><main className="auth-shell auth-shell--landing auth-shell--immersive"><div className="auth-landing">
    <section className="auth-stage" aria-labelledby="auth-title">
      <span className="auth-stage__glow auth-stage__glow--a" aria-hidden="true" />
      <span className="auth-stage__glow auth-stage__glow--b" aria-hidden="true" />
      <PulseLine className="auth-stage__pulse" />
      <div className="auth-stage__copy">
        <p className="brand" data-auth-item><BrandMark /> Mon Carnet Numérique</p>
        <h1 id="auth-title">Votre santé, votre carnet, votre décision.</h1>
        <p className="auth-stage__lead" data-auth-item>Un seul accès pour retrouver votre espace ou créer votre carnet. Vous gardez la maîtrise de vos données et de vos accès médicaux.</p>
        <ul className="auth-stage__list">{REASSURANCES.map((item) => <li key={item.text} data-auth-item><span className="auth-stage__icon"><Icon name={item.icon} size={18} /></span>{item.text}</li>)}</ul>
        <div className="actions" data-auth-item><Link href="/" className="button">Accueil</Link></div>
      </div>
    </section>
    <div id="login" className="auth-landing__panel">
      <AuthForms />
      <nav className="auth-legal-links" aria-label="Informations légales"><Link href="/mentions-legales">Mentions légales</Link><Link href="/confidentialite">Confidentialité</Link><Link href="/cgu">Conditions d’utilisation</Link><Link href="/faq">Aide</Link><Link href="/credits">Crédits</Link></nav>
    </div>
  </div></main></AuthMotion>;
}
