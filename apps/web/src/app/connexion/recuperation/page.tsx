import Link from "next/link";
import { RecoveryFlow } from "../../../components/auth/RecoveryFlow";
import { AuthUiProvider } from "../../../components/auth/AuthUiContext";
import { AuthMotion } from "../../../components/motion/AuthMotion";
import { PulseLine } from "../../../components/motion/PulseLine";
import { BrandMark } from "../../../components/ui/BrandMark";
import "../auth-immersive.css";

export const metadata = { title: "Récupérer mon compte — Mon E‑Carnet", robots: { index: false, follow: false } };

/* Même cadre que la connexion : scène à gauche (logo cliquable vers l'accueil), formulaire à droite ; sur mobile, une seule carte. */
export default function AccountRecoveryPage() {
  return <AuthUiProvider><AuthMotion><main className="auth-shell auth-shell--immersive"><div className="ax-frame">
    <section className="ax-stage" aria-labelledby="auth-title">
      <span className="ax-blob ax-blob--a" aria-hidden="true" />
      <span className="ax-blob ax-blob--b" aria-hidden="true" />
      <span className="ax-blob ax-blob--c" aria-hidden="true" />
      <PulseLine className="ax-stage__pulse" />
      <Link href="/" className="ax-brand" aria-label="Mon E‑Carnet : retour à la page d’accueil" data-auth-item><BrandMark /><span>Mon E‑Carnet</span></Link>
      <div className="ax-stage__copy">
        <p className="ax-stage__eyebrow" data-auth-item>Un souci d’accès ?</p>
        <h1 id="auth-title">Retrouvons ensemble l’accès à votre carnet.</h1>
        <p className="ax-stage__lead" data-auth-item><span className="ax-lead-long">Répondez à la question secrète que vous avez choisie pour définir un nouveau mot de passe. Aucune information de santé n’est jamais demandée.</span><span className="ax-lead-short">Répondez à votre question secrète pour choisir un nouveau mot de passe.</span></p>
      </div>
    </section>
    <div id="recuperation" className="ax-panel">
      <RecoveryFlow />
      <nav className="auth-legal-links" aria-label="Informations légales"><Link href="/mentions-legales">Mentions légales</Link><Link href="/confidentialite">Confidentialité</Link><Link href="/cgu">Conditions d’utilisation</Link><Link href="/faq">Aide</Link></nav>
    </div>
  </div></main></AuthMotion></AuthUiProvider>;
}
