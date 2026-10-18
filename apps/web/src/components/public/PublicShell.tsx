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
      <div className="pub-footer__cards">
        <section className="pub-footer__card pub-footer__card--brand" aria-label="Mon E‑Carnet">
          <Link className="pub-footer__logo" href="/" aria-label="Mon E-Carnet, accueil"><BrandMark /><span>Mon E‑Carnet</span></Link>
          <div className="pub-footer__brand-foot">
            <p className="pub-footer__tagline">Un carnet de santé personnel, <span>organisé selon vos choix.</span></p>
            <p className="pub-footer__pilot"></p>
            <PwaInstallButton />
            <div className="pub-footer__touch">
              <span className="pub-footer__script">Restons en contact !</span>
              <nav className="pub-footer__icons" aria-label="Nous joindre">
                <Link href="/#contact" aria-label="Nous écrire"><Icon name="mail" size={20} /></Link>
                <Link href="/aide" aria-label="Centre d’aide"><Icon name="help" size={20} /></Link>
                <Link href="/securite" aria-label="Sécurité"><Icon name="shield" size={20} /></Link>
              </nav>
            </div>
          </div>
        </section>
        <section className="pub-footer__card pub-footer__card--links" aria-label="Liens du site">
          <div className="pub-footer__app" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- icône de marque locale, décorative */}
            <img src="/brand/app-icon.svg" alt="" width={72} height={72} draggable={false} />
            <span className="pub-footer__app-note">Votre santé, vos choix</span>
          </div>
          <div className="pub-footer__columns">
            <div><h3 className="pub-footer__script">Découvrir</h3><nav aria-label="Découvrir"><Link href="/#parcours">Comment ça marche</Link><Link href="/#profils">Pour qui</Link><Link href="/securite">Sécurité</Link><Link href="/a-propos">À propos</Link></nav></div>
            <div><h3 className="pub-footer__script">Ressources</h3><nav aria-label="Ressources"><Link href="/aide">Centre d’aide</Link><Link href="/credits">Crédits</Link><Link href="/#contact">Nous contacter</Link><Link href="/connexion">Se connecter</Link></nav></div>
            <div className="pub-footer__col--legal"><h3 className="pub-footer__script">Informations légales</h3><nav aria-label="Informations légales"><Link href={LEGAL_DOCS.mentions.path}>{LEGAL_DOCS.mentions.short}</Link><Link href={LEGAL_DOCS.privacy.path}>{LEGAL_DOCS.privacy.short}</Link><Link href={LEGAL_DOCS.terms.path}>{LEGAL_DOCS.terms.short}</Link><Link href="/conditions-rattachement">Conditions de rattachement</Link><CookiePreferencesLink className="pub-footer__link-button">Gérer les cookies</CookiePreferencesLink></nav></div>
          </div>
          <div className="pub-footer__lower">
            <div className="pub-footer__legal">
              <span>© 2026 Mon E‑Carnet</span>
              <p className="pub-footer__made">Créé par <strong>Redianice</strong> et <FooterCredit /></p>
              <a href="#contenu">Retour en haut <Icon name="chevron" size={14} /></a>
            </div>
            <div className="pub-footer__cta">
              <p><span>La santé avance vite.</span><strong>Gardez le fil avec Mon E‑Carnet.</strong></p>
              <div className="pub-footer__pill"><span>Prêt à commencer ?</span><Link className="pub-footer__go" href="/connexion?mode=register">Créer mon carnet</Link></div>
            </div>
          </div>
        </section>
      </div>
      <div aria-hidden="true" className="pub-footer__watermark">MON E‑CARNET</div>
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
