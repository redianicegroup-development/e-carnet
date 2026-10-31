import type { Metadata } from "next";
import Link from "next/link";
import { InfoPageMotion } from "../../components/motion/InfoPageMotion";
import { BackLink } from "../../components/public/BackLink";
import { DocHero } from "../../components/public/figures/DocHero";
import { PublicShell } from "../../components/public/PublicShell";
import { Icon, type IconName } from "../../components/ui/Icon";

export const metadata: Metadata = {
  title: "Proches de confiance et profil enfant — Mon E-Carnet",
  description: "Comment fonctionnent le proche de confiance et le profil enfant : qui voit quoi, comment les créer et les retirer.",
  robots: { index: true, follow: true },
};

type Step = { icon: IconName; title: string; text: string };

const TRUSTED_STEPS: Step[] = [
  { icon: "users", title: "Vous générez un mot de rattachement", text: "Dans Moi → Proches de confiance. Il est temporaire (72 heures) et ne sert qu’une seule fois." },
  { icon: "share", title: "Vous le remettez à votre proche", text: "En main propre ou par un moyen que vous maîtrisez. Ce mot n’est pas votre mot de passe et ne donne aucun accès à votre compte." },
  { icon: "user", title: "Il le saisit dans son propre compte", text: "Votre proche doit avoir son propre compte Mon E‑Carnet. Le lien est créé quand il saisit le mot." },
  { icon: "eye", title: "Il lit votre fiche d’urgence, rien de plus", text: "Lecture seule, dans le périmètre prévu pour l’urgence. Il ne peut ni modifier votre carnet, ni générer votre QR, ni changer vos réglages." },
];

const CHILD_STEPS: Step[] = [
  { icon: "pencil", title: "Vous créez le profil de l’enfant", text: "Dans Moi → Proches et personnes représentées : prénom, nom, date de naissance et lien avec vous. L’enfant n’a pas besoin de compte." },
  { icon: "check", title: "Vous confirmez être son représentant légal", text: "Une case à cocher l’atteste. L’information est déclarée par vous : Mon E‑Carnet ne la certifie pas." },
  { icon: "idcard", title: "Son dossier est distinct du vôtre", text: "L’enfant a son propre carnet, avec ses déclarations et son historique. Rien n’est mélangé avec le vôtre." },
  { icon: "shield", title: "Vous choisissez quel dossier vous ouvrez", text: "Le vôtre ou celui de l’enfant. Quand vous agissez au nom de l’enfant, vos actions sont journalisées." },
  { icon: "lock", title: "Vous pouvez retirer le lien", text: "Le dossier et son historique sont conservés ; seul le lien de représentation est révoqué." },
];

function StepList({ steps }: { steps: Step[] }) {
  return <ol className="security__grid" style={{ listStyle: "none", padding: 0 }}>
    {steps.map((step, index) => <li className="card security__card" key={step.title}>
      <span className="security__icon" aria-hidden="true"><Icon name={step.icon} size={23} /></span>
      <div><h3>{index + 1}. {step.title}</h3><p className="muted">{step.text}</p></div>
    </li>)}
  </ol>;
}

export default function TrustedContactsAndChildrenPage() {
  return (
    <PublicShell>
      <article className="hero-page info-page security">
        <InfoPageMotion>
          <BackLink />
          <header className="info-page__head">
            <div className="info-page__head-copy">
              <span className="eyebrow">Proches et enfants</span>
              <h1>Aider un proche, représenter un enfant : comment ça marche.</h1>
              <p className="lead">Deux fonctions différentes, avec deux niveaux d’accès. Dans les deux cas, c’est vous qui décidez et qui pouvez retirer le lien.</p>
            </div>
            <DocHero icon="users" />
          </header>

          <section className="security__principles" aria-labelledby="proche-titre">
            <div className="info-page__section-intro">
              <span className="eyebrow">Proche de confiance</span>
              <h2 id="proche-titre">Une personne de votre entourage, pour l’urgence.</h2>
              <p className="muted">Pour un adulte qui a son propre compte et à qui vous voulez permettre de lire votre fiche d’urgence. Si « Proches de confiance » n’apparaît pas dans vos paramètres, la fonction n’est pas encore activée pour votre espace.</p>
            </div>
            <StepList steps={TRUSTED_STEPS} />
            <p className="muted">Vous retirez le lien à tout moment depuis Moi → Proches de confiance. Chaque accès est journalisé.</p>
          </section>

          <section className="security__principles" aria-labelledby="enfant-titre">
            <div className="info-page__section-intro">
              <span className="eyebrow">Profil enfant</span>
              <h2 id="enfant-titre">Un dossier séparé pour un enfant mineur sans compte.</h2>
              <p className="muted">Pour un parent ou un représentant légal. Une délégation pour un adulte n’entre pas dans ce parcours : un adulte doit autoriser lui-même ce qu’il partage.</p>
            </div>
            <StepList steps={CHILD_STEPS} />
          </section>

          <section className="security__principles" aria-labelledby="diff-titre">
            <div className="info-page__section-intro"><span className="eyebrow">En un coup d’œil</span><h2 id="diff-titre">Ce qui change entre les deux.</h2></div>
            <div className="security__grid">
              <article className="card security__card"><span className="security__icon" aria-hidden="true"><Icon name="users" size={23} /></span><div><h3>Proche de confiance</h3><ul className="muted"><li>Compte propre : oui</li><li>Voit : la fiche d’urgence, en lecture seule</li><li>Lien : mot temporaire à usage unique</li><li>Retrait : par le patient, à tout moment</li></ul></div></article>
              <article className="card security__card"><span className="security__icon" aria-hidden="true"><Icon name="idcard" size={23} /></span><div><h3>Profil enfant</h3><ul className="muted"><li>Compte propre : non, l’enfant n’en a pas</li><li>Voit : son propre dossier, ouvert par le représentant</li><li>Lien : représentation déclarée, actions journalisées</li><li>Retrait : le lien est révoqué, le dossier est conservé</li></ul></div></article>
            </div>
          </section>

          <aside className="notice help-data-note security__notice"><strong>À savoir :</strong> ces informations sont déclarées par vous, Mon E‑Carnet ne les certifie pas. Pour toute question, consultez l’<Link href="/aide">aide</Link>.</aside>
        </InfoPageMotion>
      </article>
    </PublicShell>
  );
}
