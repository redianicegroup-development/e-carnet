import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "../ui/BrandMark";
import { Icon } from "../ui/Icon";
import { PwaInstallButton } from "../PwaInstallButton";
import { LEGAL_DOCS } from "../../lib/legal/config";
import { PublicHeader } from "./PublicHeader";
import { CookiePreferencesLink } from "../CookieConsentBanner";
import { FooterCredit } from "./FooterCredit";

export function PublicFooter() {
  return (
    <footer className="pub-footer" data-footer-zone="true">
      <div className="pub-footer__panel">
        <div className="pub-footer__top">
          <div className="pub-footer__brand">
            <Link className="brand" href="/" aria-label="Mon E-Carnet, accueil"><BrandMark /><span className="brand-text"><strong>Mon E‑Carnet</strong><small>Carnet de santé numérique</small></span></Link>
            <p>Un carnet de santé personnel, organisé selon vos choix.</p>
            <p className="pub-footer__pilot">Version pilote : utilisez uniquement des données fictives pour le moment.</p>
            <PwaInstallButton />
          </div>
          <div className="pub-footer__columns">
            <div><h3>Découvrir</h3><nav aria-label="Découvrir"><Link href="/#parcours">Comment ça marche</Link><Link href="/#profils">Pour qui</Link><Link href="/securite">Sécurité</Link><Link href="/a-propos">À propos</Link></nav></div>
            <div><h3>Ressources</h3><nav aria-label="Ressources"><Link href="/faq">Centre d’aide</Link><Link href="/aide">Guides et aide</Link><Link href="/credits">Crédits</Link><Link href="/#contact">Nous contacter</Link><Link href="/connexion">Se connecter</Link></nav></div>
            <div className="pub-footer__col--legal"><h3>Informations légales</h3><nav aria-label="Informations légales"><Link href={LEGAL_DOCS.mentions.path}>{LEGAL_DOCS.mentions.short}</Link><Link href={LEGAL_DOCS.privacy.path}>{LEGAL_DOCS.privacy.short}</Link><Link href={LEGAL_DOCS.terms.path}>{LEGAL_DOCS.terms.short}</Link><Link href="/conditions-rattachement">Conditions de rattachement</Link><CookiePreferencesLink className="pub-footer__link-button">Gérer les cookies</CookiePreferencesLink></nav></div>
          </div>
        </div>
        <div aria-hidden="true" className="pub-footer__watermark">MON E‑CARNET</div>
        <div className="pub-footer__bottom">
          <span>© 2026 Mon E‑Carnet</span>
          <p className="pub-footer__made">Créé par <strong>Redianice</strong> et <FooterCredit /></p>
          <a href="#contenu">Retour en haut <Icon name="chevron" size={14} /></a>
        </div>
      </div>
    </footer>
  );
}

/** `bleed` : la page gère elle-même ses largeurs (sections pleine largeur, comme la landing) au lieu de la colonne centrée par défaut. */
export function PublicShell({ children, bleed = false }: { children: ReactNode; bleed?: boolean }) {
  return (
    <div className="pub">
      <a className="skip-link" href="#contenu">Aller au contenu</a>
      <PublicHeader />
      <main id="contenu" className={bleed ? "pub-main pub-main--bleed" : "pub-main"}>{children}</main>
      <PublicFooter />
    </div>
  );
}
