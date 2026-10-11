import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "../ui/Icon";

export function PublicHeader() {
  return (
    <header className="pub-header">
      <Link className="brand" href="/" aria-label="Mon Carnet Numérique, accueil">
        <span className="brand-mark" aria-hidden="true"><Icon name="plus" size={16} strokeWidth={2.4} /></span>
        <span className="brand-text"><strong>E-carnet</strong><small>Mon Carnet Numérique</small></span>
      </Link>
      <nav className="pub-nav" aria-label="Navigation principale">
        <Link href="/#parcours">Comment ça marche</Link>
        <Link href="/#profils">Pour qui</Link>
        <Link href="/securite">Sécurité</Link>
        <Link href="/aide">Aide</Link>
      </nav>
      <div className="pub-actions">
        <Link className="button ghost small" href="/connexion">Se connecter</Link>
        <Link className="button primary small" href="/connexion?mode=register">Créer mon carnet</Link>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="pub-footer">
      <div className="pub-footer__brand">
        <span className="brand-mark" aria-hidden="true"><Icon name="plus" size={16} strokeWidth={2.4} /></span>
        <div><strong>Mon Carnet Numérique</strong><p>Un carnet de santé personnel, contrôlé par le patient.</p></div>
      </div>
      <nav aria-label="Pied de page">
        <Link href="/a-propos">À propos</Link>
        <Link href="/securite">Sécurité</Link>
        <Link href="/aide">Aide</Link>
        <Link href="/connexion">Connexion</Link>
      </nav>
      <p className="pub-footer__note">Utilisez uniquement des données fictives pour le moment. E‑Carnet ne remplace pas un avis médical.</p>
    </footer>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="pub">
      <a className="skip-link" href="#contenu">Aller au contenu</a>
      <PublicHeader />
      <main id="contenu" className="pub-main">{children}</main>
      <PublicFooter />
    </div>
  );
}
