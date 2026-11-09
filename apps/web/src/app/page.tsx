import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ContactSection } from "../components/landing/ContactSection";
import { AccessDemo } from "../components/landing2/AccessDemo";
import { DetailRows } from "../components/landing2/DetailRows";
import { FlowSection } from "../components/landing2/FlowSection";
import { LandingReveal } from "../components/landing2/LandingReveal";
import { ObjectionCards } from "../components/landing2/ObjectionCards";
import { ProblemSection } from "../components/landing2/ProblemSection";
import { RoleCards } from "../components/landing2/RoleCards";
import { SolutionSection } from "../components/landing2/SolutionSection";
import { ToolTiles } from "../components/landing2/ToolTiles";
import { TrustCopy } from "../components/landing2/TrustCopy";
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
const PAGE_DESCRIPTION = "Rassemblez vos informations de santé dans un carnet, remettez-le au médecin à chaque consultation et gardez la maîtrise des accès. Votre espace sécurisé.";

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

      {/* Sections sous le hero, dans l'ordre d'une landing qui convertit : problème, solution, bénéfices, fonctionnement, rôles, objections.
          Le héro ci-dessus, le contact (appel à l'action final) et le pied de page de l'application gardent leur structure.
          Pas de bandeau « ils nous font confiance » ni de témoignages : rien de réel à y mettre pour l'instant. */}
      <div className="lp2">
        <LandingReveal />
        <section className="lp2-bleed lp2-bleed--dark" id="probleme" aria-labelledby="problem-title"><ProblemSection /></section>
        <section className="lp2-sec" id="solution" aria-labelledby="solution-title"><SolutionSection /></section>
        <section className="lp2-sec lp2-flush" id="fonctionnalites" aria-labelledby="tools-title">
          <ToolTiles />
          <div className="lp2-after-tiles"><DetailRows /></div>
        </section>
        <section className="lp2-bleed" id="parcours" aria-labelledby="flow-title">
          <div className="lp2-flow-wrap">
            <div className="lp2-head lp2-left lp2-rv">
              <h2 id="flow-title">Trois étapes, de votre carnet à ses préconisations</h2>
              <p className="lp2-lead">Un infirmier prépare, ou le médecin consulte directement : il scanne votre QR depuis son espace professionnel.</p>
            </div>
            <FlowSection />
          </div>
        </section>
        <section className="lp2-sec" id="profils" aria-labelledby="roles-title"><RoleCards /></section>
        <section className="lp2-sec lp2-flush" id="objections" aria-labelledby="objections-title"><ObjectionCards /></section>
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
