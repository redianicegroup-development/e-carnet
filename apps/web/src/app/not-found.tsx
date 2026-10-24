import Link from "next/link";
import { BrandMark } from "../components/ui/BrandMark";

export const metadata = { title: "Page introuvable — Mon E-Carnet", robots: { index: false, follow: false } };

/* Page 404 aux couleurs du site : le patient comprend ce qui s'est passé et sait où aller. */
export default function NotFound() {
  return (
    <main className="shell onboarding-choice">
      <section className="hero-page">
        <BrandMark />
        <span className="eyebrow">Erreur 404</span>
        <h1>Cette page n’existe pas ou a changé d’adresse.</h1>
        <p className="lead">Votre carnet n’est pas touché. Vérifiez l’adresse saisie, ou repartez de l’accueil.</p>
        <div className="actions">
          <Link className="button primary" href="/patient">Aller à mon espace</Link>
          <Link className="button" href="/">Retour à l’accueil du site</Link>
        </div>
      </section>
    </main>
  );
}
