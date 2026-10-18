import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ContactSection } from "../components/landing/ContactSection";
import { FaqSection } from "../components/landing/FaqSection";
import { HeroScene } from "../components/landing/HeroScene";
import { LandingMotion } from "../components/motion/LandingMotion";
import { PulseLine } from "../components/motion/PulseLine";
import { PublicShell } from "../components/public/PublicShell";
import { Icon } from "../components/ui/Icon";
import { FAQ_ITEMS, FEATURES, HERO, HERO_IMAGE, PROFILES, SAFEGUARDS, STEPS } from "../lib/landing-content";
import { LEGAL_DOCS } from "../lib/legal/config";
import { SITE_URL } from "../lib/site";
import "./landing.css";
import "./landing-immersive.css";
import "./landing-showcase.css";

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
              <Link className="button primary" href={HERO.primary.href}>{HERO.primary.label}<Icon name="chevron" size={18} /></Link>
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

      {/* 2 · Le carnet en pratique : quatre outils, les repères chiffrés vivent dans les cartes concernées. */}
      <section className="lp-section lp-features" id="fonctionnalites" aria-labelledby="features-title">
        <div className="lp-split-head">
          <div className="lp-split-head__title"><h2 id="features-title" data-split>Tout pour tenir votre carnet, rien de superflu</h2></div>
          <p className="lead">Quatre outils simples, pensés pour que le patient reste celui qui décide.</p>
        </div>
        <div className="lp-features__grid">{FEATURES.map((feature) => <article className="lp-feature" key={feature.title}>
          <span className="lp-feature__icon"><Icon name={feature.icon} size={22} /></span>
          <h3>{feature.title}</h3>
          {feature.figure && <p className="lp-feature__figure"><strong>{feature.figure.value}{feature.figure.unit && <small>{feature.figure.unit}</small>}</strong><span>{feature.figure.label}</span></p>}
          <p>{feature.text}</p>
        </article>)}</div>
      </section>

      {/* 3 · Comment ça marche : trois moments. */}
      <section className="lp-section lp-flow" id="parcours" aria-labelledby="steps-title">
        <div className="lp-flow__intro"><h2 id="steps-title" data-split>Du carnet au rendez-vous</h2><p className="lead">Trois moments simples, et le patient décide à chaque instant.</p></div>
        <div className="lp-steps-wrap" data-steps><span className="lp-steps__rail" aria-hidden="true"><i data-rail-fill /></span><ol className="lp-steps">{STEPS.map((step, index) => <li key={step.title} className="lp-step" data-step><span className="lp-step__marker"><Icon name={step.icon} size={20} /></span><div className="lp-step__body"><h3>{step.title}</h3><p>{step.text}</p></div><span className="lp-step__num" aria-hidden="true">{index + 1}</span></li>)}</ol></div>
      </section>

      {/* 4 · Un espace adapté à chaque rôle. */}
      <section className="lp-section" id="profils" aria-labelledby="profiles-title">
        <div className="lp-heading"><h2 id="profiles-title" data-split>Un espace pour chaque rôle</h2></div>
        <div className="lp-profiles">{PROFILES.map((profile, index) => {
          const className = index === 0 ? "button primary" : "button";
          return <article className={index === 0 ? "lp-profile lp-profile--lead" : "lp-profile"} key={profile.label}>
            <span className="lp-icon"><Icon name={profile.icon} size={22} /></span><p className="lp-profile__role">{profile.label}</p><h3>{profile.title}</h3>
            <ul>{profile.points.map((point) => <li key={point}><Icon name="check" size={16} />{point}</li>)}</ul>
            {profile.cta.subject
              ? <a className={className} href={profile.cta.href} data-contact-subject={profile.cta.subject}>{profile.cta.text}</a>
              : <Link className={className} href={profile.cta.href}>{profile.cta.text}</Link>}
          </article>;
        })}</div>
      </section>

      {/* 5 · Confiance : la démonstration d'une demande d'accès, puis les six questions essentielles (le reste est dans le centre d'aide). */}
      <div className="lp-chapter">
        <section className="lp-section" aria-labelledby="trust-title">
          <div className="lp-trust">
            <div className="lp-trust__copy"><h2 id="trust-title" data-split>Vous gardez la main sur les accès.</h2><ul className="lp-safeguards">{SAFEGUARDS.map((item) => <li key={item}><Icon name="shield" size={18} />{item}</li>)}</ul><p className="lp-trust__note"><Link href="/aide#donnees">En savoir plus sur la confidentialité et les données</Link></p></div>
          <div className="lp-consent" data-consent data-state="pending" aria-hidden="true"><div className="lp-consent__head"><span className="lp-consent__title">Demande d’accès</span><span className="lp-consent__tag"><b className="t-pending">À examiner</b><b className="t-granted">Accès autorisé</b><b className="t-revoked">Accès révoqué</b></span></div><dl className="lp-consent__rows"><div><dt>Périmètre</dt><dd>Informations de consultation</dd></div><div><dt>Durée</dt><dd>2 heures</dd></div></dl><div className="lp-consent__meter"><span className="lp-consent__bar" /></div><div className="lp-consent__actions"><span className="lp-consent__btn">Refuser</span><span className="lp-consent__btn lp-consent__btn--main"><b className="t-pending">Autoriser</b><b className="t-granted">Révoquer</b><b className="t-revoked">Révoqué</b></span></div><p className="lp-consent__foot">Exemple illustré</p></div>
          </div>
        </section>
        <FaqSection />
      </div>

      {/* 6 · Contact et appel à l'action final, dans une seule section. */}
      <ContactSection privacyHref={LEGAL_DOCS.privacy.path} />
    </LandingMotion>
  </PublicShell>;
}
