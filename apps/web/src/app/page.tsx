import type { Metadata } from "next";
import Link from "next/link";
import { LandingMotion } from "../components/motion/LandingMotion";
import { PulseLine } from "../components/motion/PulseLine";
import { PublicShell } from "../components/public/PublicShell";
import { SurveyRatingSummary } from "../components/SurveyRatingSummary";
import { Icon, type IconName } from "../components/ui/Icon";
import { SITE_URL } from "../lib/site";
import "./landing.css";
import "./landing-immersive.css";

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

const PROMISES: { icon: IconName; title: string; text: string }[] = [
  { icon: "lock", title: "Vous décidez", text: "Chaque accès nécessite votre accord." },
  { icon: "eye", title: "Vous gardez le fil", text: "Retrouvez les demandes et l’historique des accès." },
  { icon: "shield", title: "Les informations sont distinguées", text: "Vos déclarations restent séparées des informations validées par un professionnel." },
];
const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: "pencil", title: "Préparez", text: "Notez les informations utiles avant votre rendez-vous." },
  { icon: "qr", title: "Présentez votre QR", text: "Le professionnel envoie une demande d’accès." },
  { icon: "check", title: "Choisissez", text: "Vérifiez le périmètre et autorisez ou refusez." },
  { icon: "stethoscope", title: "Consultez", text: "Le professionnel voit uniquement les informations autorisées." },
  { icon: "folder", title: "Retrouvez", text: "Gardez vos informations et leur historique au même endroit." },
];
const PROFILES: { icon: IconName; label: string; title: string; points: string[]; cta: { href: string; text: string } }[] = [
  { icon: "user", label: "Patients", title: "Votre santé, organisée", points: ["Préparez vos consultations", "Gardez la maîtrise des accès"], cta: { href: "/connexion?mode=register", text: "Créer mon carnet" } },
  { icon: "stethoscope", label: "Professionnels", title: "Un accès patient par patient", points: ["Demandez une autorisation", "Consultez selon le périmètre accordé"], cta: { href: "/connexion?mode=register&profil=professionnel", text: "Créer mon profil" } },
  { icon: "building", label: "Établissements", title: "Gérez vos rattachements", points: ["Invitez les professionnels", "Traitez les demandes de rattachement"], cta: { href: "/aide#etablissements", text: "Contacter l’équipe" } },
];
const SAFEGUARDS = [
  "Le patient autorise chaque accès",
  "Le périmètre et la durée sont visibles",
  "Les décisions restent consultables dans l’historique",
];
const FAQ_ITEMS = [
  { q: "À quoi sert Mon Carnet Numérique ?", a: "E‑Carnet aide à organiser des informations de santé, préparer les consultations et gérer les demandes d’accès au carnet. Le service ne remplace pas un avis médical ni les services d’urgence." },
  { q: "Puis-je saisir mes vraies données de santé ?", a: "Non. Cette version est un pilote : utilisez uniquement des données fictives. N’ajoutez pas de vrais renseignements médicaux ni d’identifiants de patients." },
  { q: "Un professionnel peut-il consulter mon carnet sans mon accord ?", a: "Non. Le professionnel doit être rattaché à un établissement actif et le patient doit autoriser une demande pour un contenu et une durée précis. Le QR code lance une demande, il n’ouvre pas le carnet." },
  { q: "Comment créer un compte patient ou professionnel ?", a: "Ouvrez Connexion ou inscription, choisissez Nouveau compte, puis le rôle souhaité. Les moyens de connexion disponibles sont présentés dans le formulaire." },
];

function PhoneMock() {
  const tabs: [IconName, string, boolean][] = [["home", "Accueil", true], ["folder", "Carnet", false], ["stethoscope", "Consult.", false], ["share", "Accès", false], ["user", "Moi", false]];
  return <div className="lp-phone" role="img" aria-label="Aperçu de l’espace patient">
    <div className="lp-phone__screen" aria-hidden="true">
      <div className="mk-bar"><span className="mk-brand"><i>＋</i>E-carnet</span><span className="mk-avatar">EC</span></div>
      <div className="mk-body"><p className="mk-hello"><small>Mon espace</small><strong>Mon carnet</strong></p><div className="mk-alert"><strong>Demande d’accès</strong><span>À examiner</span><b>Voir</b></div><div className="mk-cta"><small>À préparer</small><strong>Ma consultation</strong></div><div className="mk-stats"><span><b>+</b>Déclarations</span><span><b>›</b>Consultations</span><span><b>✓</b>Accès</span></div></div>
      <div className="mk-tabs">{tabs.map(([icon, label, active]) => <span key={label} className={active ? "on" : ""}><Icon name={icon} size={16} />{label}</span>)}</div>
    </div>
  </div>;
}

export default function HomePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: SITE_URL, name: "Mon Carnet Numérique", inLanguage: "fr-FR", description: PAGE_DESCRIPTION },
      { "@type": "WebApplication", "@id": `${SITE_URL}/#application`, name: "Mon Carnet Numérique", url: SITE_URL, applicationCategory: "HealthApplication", operatingSystem: "Web", inLanguage: "fr-FR", description: PAGE_DESCRIPTION, isPartOf: { "@id": `${SITE_URL}/#website` } },
      { "@type": "FAQPage", "@id": `${SITE_URL}/#faq`, mainEntity: FAQ_ITEMS.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    ],
  };

  return <PublicShell>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    <LandingMotion>
      <section className="lp-hero" aria-labelledby="hero-title" data-hero>
        <span className="lp-hero__glow lp-hero__glow--a" aria-hidden="true" />
        <span className="lp-hero__glow lp-hero__glow--b" aria-hidden="true" />
        <PulseLine className="lp-hero__pulse" />
        <div className="lp-hero__copy">
          <span className="eyebrow" data-hero-item>Carnet de santé numérique</span>
          <h1 id="hero-title">Votre carnet de santé, sous votre contrôle.</h1>
          <p className="lead" data-hero-item>Organisez vos informations, préparez vos consultations et choisissez qui peut consulter votre carnet.</p>
          <div className="actions" data-hero-item><Link className="button primary" href="/connexion?mode=register">Créer mon espace patient<Icon name="chevron" size={18} /></Link><Link className="button" href="/connexion?mode=register&profil=professionnel">Je suis professionnel</Link></div>
          <p className="lp-hero__note" data-hero-item><Icon name="shield" size={16} />Version pilote : utilisez uniquement des données fictives.</p>
        </div>
        <PhoneMock />
      </section>
      <section className="lp-section" aria-label="Fonctionnalités clés"><div className="lp-promises">{PROMISES.map((item) => <article className="lp-promise" key={item.title}><span className="lp-promise__rule" aria-hidden="true" data-rule /><span className="lp-icon"><Icon name={item.icon} size={22} /></span><h2>{item.title}</h2><p>{item.text}</p></article>)}</div></section>
      <section className="lp-section lp-flow" id="parcours" aria-labelledby="steps-title">
        <div className="lp-flow__intro"><h2 id="steps-title" data-split>Du carnet au rendez-vous</h2><p className="lead">Cinq étapes simples, et le patient décide à chaque instant.</p></div>
        <div className="lp-steps-wrap" data-steps><span className="lp-steps__rail" aria-hidden="true"><i data-rail-fill /></span><ol className="lp-steps">{STEPS.map((step, index) => <li key={step.title} className="lp-step" data-step><span className="lp-step__marker"><Icon name={step.icon} size={20} /></span><div className="lp-step__body"><h3>{step.title}</h3><p>{step.text}</p></div><span className="lp-step__num" aria-hidden="true">{index + 1}</span></li>)}</ol></div>
      </section>
      <section className="lp-section" id="profils" aria-labelledby="profiles-title">
        <div className="lp-heading"><h2 id="profiles-title" data-split>Un espace pour chaque rôle</h2></div>
        <div className="lp-profiles">{PROFILES.map((profile, index) => <article className={index === 0 ? "lp-profile lp-profile--lead" : "lp-profile"} key={profile.label}><span className="lp-icon"><Icon name={profile.icon} size={22} /></span><span className="eyebrow">{profile.label}</span><h3>{profile.title}</h3><ul>{profile.points.map((point) => <li key={point}><Icon name="check" size={16} />{point}</li>)}</ul><Link className={index === 0 ? "button primary" : "button"} href={profile.cta.href}>{profile.cta.text}</Link></article>)}</div>
      </section>
      <section className="lp-section lp-trust" aria-labelledby="trust-title">
        <div className="lp-trust__copy"><h2 id="trust-title" data-split>Vous gardez la main sur les accès.</h2><ul className="lp-safeguards">{SAFEGUARDS.map((item) => <li key={item}><Icon name="shield" size={18} />{item}</li>)}</ul><p className="lp-trust__note"><Link href="/aide#confidentialite">En savoir plus sur la confidentialité et les données</Link></p></div>
        <div className="lp-consent" data-consent data-state="pending" aria-hidden="true"><div className="lp-consent__head"><span className="lp-consent__title">Demande d’accès</span><span className="lp-consent__tag"><b className="t-pending">À examiner</b><b className="t-granted">Accès autorisé</b><b className="t-revoked">Accès révoqué</b></span></div><dl className="lp-consent__rows"><div><dt>Périmètre</dt><dd>Informations de consultation</dd></div><div><dt>Durée</dt><dd>2 heures</dd></div></dl><div className="lp-consent__meter"><span className="lp-consent__bar" /></div><div className="lp-consent__actions"><span className="lp-consent__btn">Refuser</span><span className="lp-consent__btn lp-consent__btn--main"><b className="t-pending">Autoriser</b><b className="t-granted">Révoquer</b><b className="t-revoked">Révoqué</b></span></div><p className="lp-consent__foot">Exemple illustré · données fictives</p></div>
      </section>
      <SurveyRatingSummary />
      <section className="lp-section lp-faq-section" id="questions" aria-labelledby="faq-title">
        <div className="lp-heading"><span className="eyebrow">Réponses claires</span><h2 id="faq-title" data-split>Questions fréquentes sur E‑Carnet</h2><p>Les informations essentielles avant de créer votre espace.</p></div>
        <div className="lp-faq">{FAQ_ITEMS.map(({ q, a }) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
        <Link className="lp-more" href="/faq">Voir toutes les questions et les guides <Icon name="chevron" size={16} /></Link>
      </section>
      <section className="lp-final" aria-labelledby="final-title"><PulseLine className="lp-final__pulse" /><h2 id="final-title">Commencez avec votre carnet.</h2><p>Créez votre espace patient ou professionnel depuis une seule page. Pour le moment, utilisez des données fictives.</p><div className="actions"><Link className="button primary" href="/connexion?mode=register">Créer mon espace patient</Link><Link className="button" href="/connexion">Se connecter</Link><Link className="button" href="/aide">Centre d’aide</Link></div></section>
    </LandingMotion>
  </PublicShell>;
}
