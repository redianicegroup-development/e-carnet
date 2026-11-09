import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ContactSection } from "../components/landing/ContactSection";
import { AccessDemo } from "../components/landing2/AccessDemo";
import { DetailRows } from "../components/landing2/DetailRows";
import { FlowSection } from "../components/landing2/FlowSection";
import { LandingReveal } from "../components/landing2/LandingReveal";
import { OfflineBand } from "../components/landing2/OfflineBand";
import { RoleCards } from "../components/landing2/RoleCards";
import { ToolTiles } from "../components/landing2/ToolTiles";
import { TrustCopy } from "../components/landing2/TrustCopy";
import { WhoCards } from "../components/landing2/WhoCards";
import { FaqSection } from "../components/landing/FaqSection";
import { HeroScene } from "../components/landing/HeroScene";
import { LandingMotion } from "../components/motion/LandingMotion";
import { PulseLine } from "../components/motion/PulseLine";
import { PublicShell } from "../components/public/PublicShell";
import { Icon } from "../components/ui/Icon";
import { FAQ_ITEMS, HERO, HERO_IMAGE } from "../lib/landing-content";
import { LEGAL_DOCS } from "../lib/legal/config";
import { SITE_URL } from "../lib/site";
import "./landing.css";
import "./landing-immersive.css";
import "./landing-showcase.css";
import "./landing-v2.css";

const PAGE_TITLE = "Carnet de santé numérique | Mon E-Carnet";
const PAGE_DESCRIPTION = "Organisez vos informations de santé, préparez vos consultations et maîtrisez les demandes d’accès. Organisez vos informations de santé dans votre espace sécurisé.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/",
    siteName: "Mon E-Carnet",
    locale: "fr_FR",
    type: "website",
    images: [{ url: "/brand/icon-512.png", width: 512, height: 512, alt: "Mon E-Carnet" }],
  },
  twitter: { card: "summary", title: PAGE_TITLE, description: PAGE_DESCRIPTION, images: ["/brand/icon-512.png"] },
  robots: { index: true, follow: true },
};

export default function HomePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: SITE_URL, name: "Mon E-Carnet", inLanguage: "fr-FR", description: PAGE_DESCRIPTION },
      { "@type": "WebApplication", "@id": `${SITE_URL}/#application`, name: "Mon E-Carnet", url: SITE_URL, applicationCategory: "HealthApplication", operatingSystem: "Web", inLanguage: "fr-FR", description: PAGE_DESCRIPTION, isPartOf: { "@id": `${SITE_URL}/#website` } },
      { "@type": "FAQPage", "@id": `${SITE_URL}/#faq`, mainEntity: FAQ_ITEMS.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    ],
  };

  return <PublicShell bleed>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    <LandingMotion>
      {/* Hero : l'image démarre petite dans le coin bas-droit et grossit au défilement (voir LandingMotion). */}
      <section className="lp-hero" aria-labelledby="hero-title" data-hero>
        <span className="lp-hero__glow lp-hero__glow--a" aria-hidden="true" />
        <span className="lp-hero__glow lp-hero__glow--b" aria-hidden="true" />
        <PulseLine className="lp-hero__pulse" />
        <div className="lp-wrap lp-hero__inner">
          <div className="lp-hero__copy" data-hero-copy>
            <span className="eyebrow" data-hero-item>{HERO.eyebrow}</span>
            <h1 id="hero-title">{HERO.title}</h1>
            <p className="lead" data-hero-item>{HERO.lead}</p>
            <div className="actions" data-hero-item>
              <Link className="button primary" href={HERO.primary.href} data-track="signup">{HERO.primary.label}<Icon name="chevron" size={18} /></Link>
              <Link className="button" href={HERO.secondary.href}>{HERO.secondary.label}</Link>
            </div>
            <p className="lp-hero__note" data-hero-item><Icon name="shield" size={16} />{HERO.note}</p>
          </div>
        </div>
        {HERO_IMAGE
          ? <div className="lp-hero__media lp-hero__media--photo" data-hero-media><picture><source media="(max-width: 759px)" srcSet={HERO_IMAGE.mobileSrc} /><Image src={HERO_IMAGE.desktopSrc} alt={HERO_IMAGE.alt} fill priority sizes="100vw" /></picture></div>
          : <div className="lp-hero__media" data-hero-media role="img" aria-label={HERO.sceneLabel}><HeroScene /></div>}
        <div className="lp-hero__reveal" data-hero-reveal aria-hidden="true">
          <div className="lp-wrap">
            <p className="lp-hero__reveal-title" data-reveal-line>{HERO.reveal.title}</p>
            <p className="lp-hero__reveal-text" data-reveal-line>{HERO.reveal.text}</p>
          </div>
        </div>
      </section>

      {/* Sections 2 à 5, reprises de la maquette HTML de la landing (composants landing2). Le héro ci-dessus, la FAQ, le contact et le pied de page restent ceux de l'application. */}
      <div className="lp2">
        <LandingReveal />
        <section className="lp2-sec" aria-labelledby="who-title"><WhoCards /></section>
        <section className="lp2-sec" id="fonctionnalites" aria-labelledby="tools-title"><ToolTiles /></section>
        <section className="lp2-bleed" id="parcours" aria-labelledby="flow-title">
          <div className="lp2-flow-wrap">
            <div className="lp2-head lp2-left lp2-rv">
              <span className="lp2-eyebrow">Comment ça marche</span>
              <h2 id="flow-title">Du carnet au rendez-vous</h2>
              <p className="lp2-lead">Trois moments simples. Vous décidez à chaque étape.</p>
            </div>
            <FlowSection />
          </div>
        </section>
        <section className="lp2-sec" aria-label="Fonctionnalités en détail"><DetailRows /></section>
        <section className="lp2-sec lp2-flush" aria-labelledby="off-title"><OfflineBand /></section>
        <section className="lp2-sec lp2-flush" id="profils" aria-labelledby="roles-title"><RoleCards /></section>
        <section className="lp2-sec lp2-flush" aria-labelledby="trust-title">
          <div className="lp2-trust"><TrustCopy /><AccessDemo /></div>
        </section>
      </div>
      <FaqSection />

      {/* 6 · Contact et appel à l'action final, dans une seule section. */}
      <ContactSection privacyHref={LEGAL_DOCS.privacy.path} />
    </LandingMotion>
  </PublicShell>;
}
