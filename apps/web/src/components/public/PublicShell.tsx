import { APP_SLOGAN } from "../../lib/brand";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "../ui/BrandMark";
import { Icon } from "../ui/Icon";
import { SocialIcon } from "../ui/SocialIcon";
import { socialLinks } from "../../lib/social";
import { PwaInstallButton } from "../PwaInstallButton";
import { LEGAL_DOCS } from "../../lib/legal/config";
import { PROJECT_LOGO_WEBP } from "../../lib/brand";
import { PublicHeader } from "./PublicHeader";
import { BackToTopButton } from "./BackToTopButton";
import { ScrollToTopOnNavigate } from "../ScrollToTopOnNavigate";
import { FooterBarsHider } from "../shell/FooterBarsHider";
import { CookiePreferencesLink } from "../CookieConsentBanner";
import { FooterCredit, RedianiceCredit } from "./FooterCredit";

export function PublicFooter() {
  return (
    <footer className="pub-footer" data-footer-zone="true">
      <ScrollToTopOnNavigate />
      <FooterBarsHider />
      <div className="pub-footer__cards">
        <section className="pub-footer__card pub-footer__card--brand" aria-label="Mon E‑Carnet">
          <Link className="pub-footer__logo" href="/" aria-label="Mon E-Carnet, accueil"><BrandMark detail /><span className="notranslate" translate="no">Mon E‑Carnet</span></Link>
          <div className="pub-footer__brand-foot">
            <p className="pub-footer__slogan">{APP_SLOGAN}</p>
            <PwaInstallButton />
            <div className="pub-footer__touch">
              <span className="pub-footer__script">Restons en contact !</span>
              <nav className="pub-footer__icons" aria-label="Nous joindre">
                {socialLinks().map((link) => {
                  const icon = link.id === "email" ? <Icon name="mail" size={20} /> : <SocialIcon name={link.id} size={20} />;
                  if (!link.href) return <span key={link.id} className="is-soon" role="img" aria-label={`${link.label} : bientôt disponible`} title="Bientôt">{icon}</span>;
                  return link.external
                    ? <a key={link.id} href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.label}>{icon}</a>
                    : <Link key={link.id} href={link.href} aria-label={link.label}>{icon}</Link>;
                })}
              </nav>
            </div>
          </div>
        </section>
        <section className="pub-footer__card pub-footer__card--links" aria-label="Liens du site">
          <div className="pub-footer__app" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- icône de marque locale, décorative */}
            <img src={PROJECT_LOGO_WEBP} alt="" width={72} height={72} draggable={false} referrerPolicy="no-referrer" />
            <span className="pub-footer__app-note">Votre santé, vos choix</span>
          </div>
          <div className="pub-footer__columns">
            <div><h3 className="pub-footer__script">Découvrir</h3><nav aria-label="Découvrir"><Link href="/#parcours">Comment ça marche</Link><Link href="/#profils">Pour qui</Link><Link href="/securite">Sécurité</Link><Link href="/a-propos">À propos</Link></nav></div>
            <div><h3 className="pub-footer__script">Ressources</h3><nav aria-label="Ressources"><Link href="/aide">Centre d’aide</Link><Link href="/credits">Crédits</Link><Link href="/#contact">Nous contacter</Link><Link href="/connexion">Se connecter</Link></nav></div>
            <div className="pub-footer__col--legal"><h3 className="pub-footer__script">Informations légales</h3><nav aria-label="Informations légales"><Link href={LEGAL_DOCS.mentions.path}>{LEGAL_DOCS.mentions.short}</Link><Link href={LEGAL_DOCS.privacy.path}>{LEGAL_DOCS.privacy.short}</Link><Link href={LEGAL_DOCS.terms.path}>{LEGAL_DOCS.terms.short}</Link><Link href="/conditions-rattachement">Conditions de rattachement</Link><CookiePreferencesLink className="pub-footer__link-button">Gérer les cookies</CookiePreferencesLink></nav></div>
          </div>
          <div className="pub-footer__lower">
            <div className="pub-footer__legal">
              <span>© 2026 <span className="notranslate" translate="no">Mon E‑Carnet</span></span>
              <p className="pub-footer__made">Créé par <RedianiceCredit /> et <FooterCredit /></p>
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
      <BackToTopButton />
    </div>
  );
}
