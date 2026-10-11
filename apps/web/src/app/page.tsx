import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "../components/public/PublicShell";
import { SurveyRatingSummary } from "../components/SurveyRatingSummary";
import { Icon, type IconName } from "../components/ui/Icon";
import "./landing.css";

export const metadata: Metadata = {
  title: "Mon Carnet Numérique — votre carnet de santé, sous votre contrôle",
  description: "Organisez vos informations de santé, préparez vos consultations et choisissez qui peut consulter votre carnet.",
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
  return <PublicShell>
    <section className="lp-hero" aria-labelledby="hero-title">
      <div className="lp-hero__copy">
        <span className="eyebrow">Carnet de santé numérique</span>
        <h1 id="hero-title">Votre carnet de santé, sous votre contrôle.</h1>
        <p className="lead">Organisez vos informations, préparez vos consultations et choisissez qui peut consulter votre carnet.</p>
        <div className="actions"><Link className="button primary" href="/connexion?mode=register">Créer mon carnet<Icon name="chevron" size={18} /></Link><Link className="button" href="/connexion?mode=register&profil=professionnel">Je suis professionnel</Link></div>
        <p className="lp-hero__note"><Icon name="shield" size={16} />Utilisez uniquement des données fictives pour le moment.</p>
      </div>
      <PhoneMock />
    </section>

    <section className="lp-section" aria-label="Fonctionnalités clés"><div className="lp-promises">{PROMISES.map((item) => <article className="lp-promise" key={item.title}><span className="lp-icon"><Icon name={item.icon} size={22} /></span><h2>{item.title}</h2><p>{item.text}</p></article>)}</div></section>

    <section className="lp-section" id="parcours" aria-labelledby="steps-title">
      <div className="lp-heading"><span className="eyebrow">Le parcours</span><h2 id="steps-title">Du carnet au rendez-vous</h2></div>
      <ol className="lp-steps">{STEPS.map((step, index) => <li key={step.title} className="lp-step"><span className="lp-step__num">{index + 1}</span><span className="lp-icon"><Icon name={step.icon} size={22} /></span><h3>{step.title}</h3><p>{step.text}</p></li>)}</ol>
    </section>

    <section className="lp-section" id="profils" aria-labelledby="profiles-title">
      <div className="lp-heading"><span className="eyebrow">Pour qui</span><h2 id="profiles-title">Un espace pour chaque rôle</h2></div>
      <div className="lp-profiles">{PROFILES.map((profile) => <article className="lp-profile" key={profile.label}><span className="lp-icon"><Icon name={profile.icon} size={22} /></span><span className="eyebrow">{profile.label}</span><h3>{profile.title}</h3><ul>{profile.points.map((point) => <li key={point}><Icon name="check" size={16} />{point}</li>)}</ul><Link className="button" href={profile.cta.href}>{profile.cta.text}</Link></article>)}</div>
    </section>

    <section className="lp-section lp-trust" aria-labelledby="trust-title">
      <div className="lp-heading"><span className="eyebrow">Partage maîtrisé</span><h2 id="trust-title">Vous gardez la main sur les accès.</h2></div>
      <ul className="lp-safeguards">{SAFEGUARDS.map((item) => <li key={item}><Icon name="shield" size={18} />{item}</li>)}</ul>
      <p className="lp-trust__note"><Link href="/aide#confidentialite">En savoir plus sur la confidentialité et les données</Link></p>
    </section>

    <SurveyRatingSummary />

    <section className="lp-final" aria-labelledby="final-title"><h2 id="final-title">Commencez avec votre carnet.</h2><p>Une seule page pour créer un compte ou vous connecter.</p><div className="actions"><Link className="button primary" href="/connexion?mode=register">Créer mon carnet</Link><Link className="button" href="/connexion">Se connecter</Link><Link className="button" href="/aide">Centre d’aide</Link></div></section>
  </PublicShell>;
}
