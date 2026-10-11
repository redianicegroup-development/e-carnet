import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "../components/public/PublicShell";
import { LandingFeedbackWidget } from "../components/LandingFeedbackWidget";
import { Icon, type IconName } from "../components/ui/Icon";
import "./landing.css";

export const metadata: Metadata = {
  title: "Mon Carnet Numérique — votre carnet de santé, sous votre contrôle",
  description: "Préparez vos consultations, autorisez un médecin en un scan, gardez la trace de chaque accès. Un carnet de santé numérique où le patient décide.",
  robots: { index: true, follow: true },
};

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
const contactHref = CONTACT ? `mailto:${CONTACT}?subject=${encodeURIComponent("Ouverture d’un accès établissement")}` : "/a-propos";

const PROMISES: { icon: IconName; title: string; text: string }[] = [
  { icon: "lock", title: "Vous décidez", text: "Aucun professionnel ne voit votre carnet sans votre accord, donné pour une durée limitée et révocable à tout moment." },
  { icon: "eye", title: "Tout est tracé", text: "Chaque lecture et chaque décision sont enregistrées. Vous savez qui a accédé à quoi, et quand." },
  { icon: "shield", title: "L’origine est visible", text: "Ce que vous déclarez n’est jamais présenté comme confirmé tant qu’un médecin ne l’a pas validé lui-même." },
];

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: "pencil", title: "Vous préparez", text: "Avant le rendez-vous, vous notez votre motif et ce que vous ressentez. Un proche ou un infirmier peut vous aider, sans avoir de compte." },
  { icon: "qr", title: "Le médecin demande l’accès", text: "Il scanne votre QR à usage unique. Cela envoie une demande : rien n’est ouvert tant que vous n’avez pas répondu." },
  { icon: "check", title: "Vous autorisez", text: "L’autorisation dure deux heures, prolongeable deux fois une heure, et vous pouvez la retirer à tout moment." },
  { icon: "stethoscope", title: "Il consulte et valide", text: "Le médecin complète à partir de votre préparation et signe. Son nom et son établissement sont conservés avec la consultation." },
  { icon: "folder", title: "Vous retrouvez tout", text: "Historique, provenance de chaque information et journal des accès restent dans votre carnet." },
];

const PROFILES: { icon: IconName; label: string; title: string; points: string[]; cta: { href: string; text: string } }[] = [
  { icon: "user", label: "Patients", title: "Un carnet qui vous appartient", points: ["Allergies, antécédents et traitements déclarés", "Préparation de vos consultations", "QR d’accès à usage unique", "Journal de tous les accès"], cta: { href: "/inscription", text: "Créer mon carnet" } },
  { icon: "stethoscope", label: "Professionnels", title: "Un accès patient par patient", points: ["Spécialité déclarée, sans pièce ni numéro professionnel", "Rattachement par le code de votre établissement", "Pré-consultation reprise sans ressaisie", "Consultation signée et traçable"], cta: { href: "/inscription?profil=professionnel", text: "Créer mon profil" } },
  { icon: "building", label: "Établissements", title: "Des médecins rattachés, sans accès aux dossiers", points: ["Ouvert sur demande par notre équipe", "Un administrateur nominatif", "Un code à usage unique par médecin", "Aucun accès aux dossiers médicaux"], cta: { href: contactHref, text: "Demander l’ouverture" } },
];

const SAFEGUARDS = [
  "Autorisation explicite, limitée dans le temps, révocable",
  "Isolation stricte entre établissements",
  "Journal d’audit des accès et des décisions sensibles",
  "Sessions serveur, protection CSRF, limitation des tentatives",
  "L’administrateur d’établissement n’accède à aucun dossier",
  "Données fictives uniquement pendant le pilote",
];

const FAQ: [string, string][] = [
  ["Un professionnel voit-il mon carnet automatiquement ?", "Non. L’établissement vérifie le professionnel en interne, l’application enregistre sa décision de rattachement, puis le patient doit autoriser l’accès. Sans son accord, rien n’est lisible."],
  ["Un infirmier a-t-il besoin d’un compte ?", "Non. Il n’existe pas de compte infirmier : une aide à la saisie se fait depuis votre propre espace, et peut être mentionnée."],
  ["Mes données de santé sont-elles déjà en ligne ?", "Non. L’application est en pilote et n’accueille que des données fictives. Elle ne sera ouverte à de vraies données qu’après une validation complète."],
];

function PhoneMock() {
  const tabs: [IconName, string, boolean][] = [["home", "Accueil", true], ["folder", "Carnet", false], ["stethoscope", "Consult.", false], ["share", "Accès", false], ["user", "Moi", false]];
  return (
    <div className="lp-phone" role="img" aria-label="Aperçu de l’espace patient : accueil, demande d’accès en attente, préparation de consultation et barre à cinq onglets">
      <div className="lp-phone__screen" aria-hidden="true">
        <div className="mk-bar"><span className="mk-brand"><i>＋</i>E-carnet</span><span className="mk-avatar">AK</span></div>
        <div className="mk-body">
          <p className="mk-hello"><small>Bonjour</small><strong>Awa</strong></p>
          <div className="mk-alert"><strong>1 demande d’accès</strong><span>Dr Koné attend votre décision.</span><b>Examiner</b></div>
          <div className="mk-cta"><small>Avant votre rendez-vous</small><strong>Préparez votre consultation</strong></div>
          <div className="mk-stats"><span><b>4</b>Déclarations</span><span><b>2</b>Pré-consult.</span><span><b>1</b>Accès actif</span></div>
        </div>
        <div className="mk-tabs">{tabs.map(([icon, label, active]) => <span key={label} className={active ? "on" : ""}><Icon name={icon} size={16} />{label}</span>)}</div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <PublicShell>
      <section className="lp-hero" aria-labelledby="hero-title">
        <div className="lp-hero__copy">
          <span className="eyebrow">Carnet de santé numérique · Pilote</span>
          <h1 id="hero-title">Votre santé, dans un carnet que vous seul décidez d’ouvrir.</h1>
          <p className="lead">Préparez vos consultations, autorisez un médecin en un scan et gardez la trace de chaque accès. Les professionnels travaillent avec votre accord, pas à votre place.</p>
          <div className="actions">
            <Link className="button primary" href="/inscription">Créer mon carnet<Icon name="chevron" size={18} /></Link>
            <Link className="button" href="/inscription?profil=professionnel">Je suis un professionnel</Link>
          </div>
          <p className="lp-hero__note"><Icon name="shield" size={16} />Pilote en cours : aucune donnée de santé réelle n’est utilisée.</p>
        </div>
        <PhoneMock />
      </section>

      <section className="lp-section" aria-label="Nos engagements">
        <div className="lp-promises">
          {PROMISES.map((item) => <article className="lp-promise" key={item.title}><span className="lp-icon"><Icon name={item.icon} size={22} /></span><h2>{item.title}</h2><p>{item.text}</p></article>)}
        </div>
      </section>

      <section className="lp-section" id="parcours" aria-labelledby="steps-title">
        <div className="lp-heading"><span className="eyebrow">Le parcours</span><h2 id="steps-title">De la préparation à l’historique, en cinq temps</h2><p className="lead">Chaque étape garde le patient au centre : il prépare, il autorise, il retrouve.</p></div>
        <ol className="lp-steps">
          {STEPS.map((step, index) => (
            <li key={step.title} className="lp-step"><span className="lp-step__num">{index + 1}</span><span className="lp-icon"><Icon name={step.icon} size={22} /></span><h3>{step.title}</h3><p>{step.text}</p></li>
          ))}
        </ol>
      </section>

      <section className="lp-section" id="profils" aria-labelledby="profiles-title">
        <div className="lp-heading"><span className="eyebrow">Pour qui</span><h2 id="profiles-title">Trois espaces, trois rôles clairs</h2><p className="lead">Chacun voit uniquement ce qui le concerne, avec la même navigation à cinq onglets.</p></div>
        <div className="lp-profiles">
          {PROFILES.map((profile) => (
            <article className="lp-profile" key={profile.label}>
              <span className="lp-icon"><Icon name={profile.icon} size={22} /></span>
              <span className="eyebrow">{profile.label}</span>
              <h3>{profile.title}</h3>
              <ul>{profile.points.map((point) => <li key={point}><Icon name="check" size={16} />{point}</li>)}</ul>
              <Link className="button" href={profile.cta.href}>{profile.cta.text}</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-section lp-trust" aria-labelledby="trust-title">
        <div className="lp-heading"><span className="eyebrow">Confiance</span><h2 id="trust-title">La sécurité vit côté serveur, pas seulement dans l’interface</h2></div>
        <ul className="lp-safeguards">{SAFEGUARDS.map((item) => <li key={item}><Icon name="shield" size={18} />{item}</li>)}</ul>
        <p className="lp-trust__note">Nous préférons être clairs : l’application est un pilote. Elle ne sera ouverte à de vraies données de santé qu’après validation complète de la sécurité, de l’hébergement et du cadre juridique. <Link href="/securite">Lire notre approche de la sécurité</Link></p>
      </section>

      <section className="lp-section" aria-labelledby="faq-title">
        <div className="lp-heading"><span className="eyebrow">Questions fréquentes</span><h2 id="faq-title">Les réponses courtes</h2></div>
        <div className="lp-faq">{FAQ.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
        <p className="lp-more"><Link href="/faq">Toutes les questions →</Link></p>
      </section>

      <section className="lp-final" aria-labelledby="final-title">
        <h2 id="final-title">Gardez la main sur votre carnet.</h2>
        <p>Créez votre compte avec Google, Facebook, Apple ou votre email, puis préparez votre première consultation.</p>
        <div className="actions"><Link className="button primary" href="/inscription">Créer mon carnet</Link><Link className="button" href="/connexion">J’ai déjà un compte</Link></div>
      </section>
      <LandingFeedbackWidget />
    </PublicShell>
  );
}
