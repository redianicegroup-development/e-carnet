import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ContactSection } from "../components/landing/ContactSection";
import { FaqSection } from "../components/landing/FaqSection";
import { HeroScene } from "../components/landing/HeroScene";
import { LandingMotion } from "../components/motion/LandingMotion";
import { PulseLine } from "../components/motion/PulseLine";
import { PublicShell } from "../components/public/PublicShell";
import { SurveyRatingSummary } from "../components/SurveyRatingSummary";
import { Icon } from "../components/ui/Icon";
import { FACTS, FAQ_ITEMS, FEATURES, HERO, HERO_IMAGE, PROFILES, SAFEGUARDS, STEPS } from "../lib/landing-content";
import { LEGAL_DOCS } from "../lib/legal/config";
import { SITE_URL } from "../lib/site";
import "./landing.css";
import "./landing-immersive.css";
import "./landing-showcase.css";

const PAGE_TITLE = "Carnet de santé numérique | Mon Carnet Numérique";
const PAGE_DESCRIPTION = "Organisez vos informations de santé, préparez vos consultations et maîtrisez les demandes d’accès. Version pilote : utilisez uniquement des données fictives.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/",
    siteName: "Mon Carnet Numérique",
    locale: "fr_FR",
    type: "website",
    images: [{ url: "/brand/icon-512.png", width: 512, height: 512, alt: "Mon Carnet Numérique" }],
  },
  twitter: { card: "summary", title: PAGE_TITLE, description: PAGE_DESCRIPTION, images: ["/brand/icon-512.png"] },
  robots: { index: true, follow: true },
};

const pad = (index: number) => String(index + 1).padStart(2, "0");

export default function HomePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: SITE_URL, name: "Mon Carnet Numérique", inLanguage: "fr-FR", description: PAGE_DESCRIPTION },
      { "@type": "WebApplication", "@id": `${SITE_URL}/#application`, name: "Mon Carnet Numérique", url: SITE_URL, applicationCategory: "HealthApplication", operatingSystem: "Web", inLanguage: "fr-FR", description: PAGE_DESCRIPTION, isPartOf: { "@id": `${SITE_URL}/#website` } },
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
          ? <div className="lp-hero__media lp-hero__media--photo" data-hero-media><Image src={HERO_IMAGE.src} alt={HERO_IMAGE.alt} fill priority sizes="100vw" /></div>
          : <div className="lp-hero__media" data-hero-media role="img" aria-label={HERO.sceneLabel}><HeroScene /></div>}
        <div className="lp-hero__reveal" data-hero-reveal aria-hidden="true">
          <div className="lp-wrap">
            <p className="lp-hero__reveal-title" data-reveal-line>{HERO.reveal.title}</p>
            <p className="lp-hero__reveal-text" data-reveal-line>{HERO.reveal.text}</p>
          </div>
        </div>
      </section>

      <section className="lp-section lp-facts" aria-label="Repères du service">
        <ul className="lp-facts__grid">{FACTS.map((fact) => <li className="lp-fact" key={fact.label}><strong>{fact.value}{fact.unit && <small>{fact.unit}</small>}</strong><span>{fact.label}</span></li>)}</ul>
      </section>

      <section className="lp-section lp-features" id="fonctionnalites" aria-labelledby="features-title">
        <div className="lp-split-head">
          <div className="lp-split-head__title"><span className="eyebrow">Fonctionnalités</span><h2 id="features-title" data-split>Tout pour tenir votre carnet, rien de superflu</h2></div>
          <p className="lead">Six outils simples, pensés pour que le patient reste celui qui décide.</p>
        </div>
        <div className="lp-features__grid">{FEATURES.map((feature, index) => <article className="lp-feature" key={feature.title}><span className="lp-feature__num" aria-hidden="true">{pad(index)}</span><span className="lp-feature__icon"><Icon name={feature.icon} size={22} /></span><h3>{feature.title}</h3><p>{feature.text}</p></article>)}</div>
      </section>

      <section className="lp-section lp-flow" id="parcours" aria-labelledby="steps-title">
        <div className="lp-flow__intro"><h2 id="steps-title" data-split>Du carnet au rendez-vous</h2><p className="lead">Cinq étapes simples, et le patient décide à chaque instant.</p></div>
        <div className="lp-steps-wrap" data-steps><span className="lp-steps__rail" aria-hidden="true"><i data-rail-fill /></span><ol className="lp-steps">{STEPS.map((step, index) => <li key={step.title} className="lp-step" data-step><span className="lp-step__marker"><Icon name={step.icon} size={20} /></span><div className="lp-step__body"><h3>{step.title}</h3><p>{step.text}</p></div><span className="lp-step__num" aria-hidden="true">{index + 1}</span></li>)}</ol></div>
      </section>

      <section className="lp-section" id="profils" aria-labelledby="profiles-title">
        <div className="lp-heading"><span className="eyebrow">Pour qui</span><h2 id="profiles-title" data-split>Un espace pour chaque rôle</h2></div>
        <div className="lp-profiles">{PROFILES.map((profile, index) => {
          const className = index === 0 ? "button primary" : "button";
          return <article className={index === 0 ? "lp-profile lp-profile--lead" : "lp-profile"} key={profile.label}>
            <span className="lp-icon"><Icon name={profile.icon} size={22} /></span><span className="eyebrow">{profile.label}</span><h3>{profile.title}</h3>
            <ul>{profile.points.map((point) => <li key={point}><Icon name="check" size={16} />{point}</li>)}</ul>
            {profile.cta.subject
              ? <a className={className} href={profile.cta.href} data-contact-subject={profile.cta.subject}>{profile.cta.text}</a>
              : <Link className={className} href={profile.cta.href}>{profile.cta.text}</Link>}
          </article>;
        })}</div>
      </section>

      <section className="lp-section" aria-labelledby="trust-title">
        <div className="lp-trust">
          <div className="lp-trust__copy"><h2 id="trust-title" data-split>Vous gardez la main sur les accès.</h2><ul className="lp-safeguards">{SAFEGUARDS.map((item) => <li key={item}><Icon name="shield" size={18} />{item}</li>)}</ul><p className="lp-trust__note"><Link href="/aide#confidentialite">En savoir plus sur la confidentialité et les données</Link></p></div>
          <div className="lp-consent" data-consent data-state="pending" aria-hidden="true"><div className="lp-consent__head"><span className="lp-consent__title">Demande d’accès</span><span className="lp-consent__tag"><b className="t-pending">À examiner</b><b className="t-granted">Accès autorisé</b><b className="t-revoked">Accès révoqué</b></span></div><dl className="lp-consent__rows"><div><dt>Périmètre</dt><dd>Informations de consultation</dd></div><div><dt>Durée</dt><dd>2 heures</dd></div></dl><div className="lp-consent__meter"><span className="lp-consent__bar" /></div><div className="lp-consent__actions"><span className="lp-consent__btn">Refuser</span><span className="lp-consent__btn lp-consent__btn--main"><b className="t-pending">Autoriser</b><b className="t-granted">Révoquer</b><b className="t-revoked">Révoqué</b></span></div><p className="lp-consent__foot">Exemple illustré · données fictives</p></div>
        </div>
      </section>

      <SurveyRatingSummary />
      <FaqSection />
      <ContactSection privacyHref={LEGAL_DOCS.privacy.path} />

      <section className="lp-section" aria-labelledby="final-title">
        <div className="lp-final"><PulseLine className="lp-final__pulse" /><h2 id="final-title">Commencez avec votre carnet.</h2><p>Créez votre espace patient ou professionnel depuis une seule page. Pour le moment, utilisez des données fictives.</p><div className="actions"><Link className="button primary" href="/connexion?mode=register">Créer mon espace patient</Link><Link className="button" href="/connexion">Se connecter</Link><Link className="button" href="/aide">Centre d’aide</Link></div></div>
      </section>
    </LandingMotion>
  </PublicShell>;
}
