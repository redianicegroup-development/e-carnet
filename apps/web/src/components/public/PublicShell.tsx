import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "../ui/BrandMark";
import { Icon } from "../ui/Icon";
import { PwaInstallButton } from "../PwaInstallButton";
import { LEGAL_DOCS } from "../../lib/legal/config";

export function PublicHeader() {
  return (
    <header className="pub-header">
      <Link className="brand" href="/" aria-label="Mon Carnet Numérique, accueil">
        <BrandMark />
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
    <footer className="pub-footer" data-footer-zone="true">
      <div className="pub-footer__panel">
        <div className="pub-footer__top">
          <div className="pub-footer__brand">
            <Link className="brand" href="/" aria-label="E-Carnet, accueil"><BrandMark /><span className="brand-text"><strong>E‑Carnet</strong><small>Mon Carnet Numérique</small></span></Link>
            <p>Un carnet de santé personnel, organisé selon vos choix.</p>
            <PwaInstallButton />
          </div>
          <div className="pub-footer__columns">
            <div><h3>Découvrir</h3><nav aria-label="Découvrir"><Link href="/#parcours">Comment ça marche</Link><Link href="/#profils">Pour qui</Link><Link href="/securite">Sécurité</Link><Link href="/a-propos">À propos</Link></nav></div>
            <div><h3>Ressources</h3><nav aria-label="Ressources"><Link href="/faq">Centre d’aide</Link><Link href="/aide">Guides et aide</Link><Link href="/credits">Crédits</Link><Link href="/connexion">Se connecter</Link></nav></div>
          </div>
        </div>
        <div aria-hidden="true" className="pub-footer__watermark">E‑CARNET</div>
        <div className="pub-footer__bottom">
          <span>© 2026 E‑Carnet</span>
          <p>Utilisez uniquement des données fictives pour le moment.</p>
          <nav aria-label="Informations légales"><Link href={LEGAL_DOCS.privacy.path}>{LEGAL_DOCS.privacy.short}</Link><Link href={LEGAL_DOCS.terms.path}>{LEGAL_DOCS.terms.short}</Link><Link href={LEGAL_DOCS.mentions.path}>{LEGAL_DOCS.mentions.short}</Link></nav>
          <a href="#contenu">Retour en haut <Icon name="chevron" size={14} /></a>
        </div>
      </div>
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
