import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "../../components/public/PublicShell";

export const metadata: Metadata = {
  title: "À propos — E-Carnet",
  description:
    "Découvrez pourquoi E-Carnet a été créé : garder un suivi de santé organisé dans la durée, au-delà des carnets papier.",
  robots: { index: true, follow: true },
};

export default function AboutPage() {
  return (
    <PublicShell>
      <article className="hero-page">
        <span className="eyebrow">À propos d’E-Carnet</span>
        <h1>Le suivi de santé ne devrait pas s’arrêter à la dernière page d’un carnet.</h1>
        <p className="lead">
          E-Carnet est né d’un constat simple : un carnet de santé papier peut se perdre,
          s’abîmer ou être rempli. Quand on le remplace par un nouveau, les informations
          se retrouvent dispersées entre plusieurs supports. Retrouver l’historique et
          garder une continuité dans le temps devient alors plus difficile.
        </p>

        <section className="stack" aria-labelledby="constat">
          <h2 id="constat">Le problème : des informations qui se dispersent</h2>
          <div className="grid">
            <section className="card">
              <h3>Un carnet peut se perdre</h3>
              <p className="muted">
                Les informations importantes peuvent devenir difficiles à retrouver lorsque
                le carnet papier est égaré ou endommagé.
              </p>
            </section>
            <section className="card">
              <h3>Un carnet se remplace</h3>
              <p className="muted">
                Une fois rempli, le carnet laisse souvent place à un autre. L’historique se
                retrouve alors réparti sur plusieurs livrets et périodes.
              </p>
            </section>
            <section className="card">
              <h3>Le suivi manque de continuité</h3>
              <p className="muted">
                Reconstituer le parcours de santé sur plusieurs années peut demander du temps
                et dépendre des documents conservés par chacun.
              </p>
            </section>
          </div>
        </section>

        <section className="stack" aria-labelledby="solution">
          <h2 id="solution">La solution : un carnet numérique pensé dans la durée</h2>
          <p>
            E-Carnet a été développé pour aider chacun à retrouver ses informations de santé
            dans un espace numérique organisé, à préparer ses consultations et à mieux suivre
            son historique au fil du temps. Le patient reste au centre : les accès aux
            informations sont encadrés et peuvent être autorisés selon les fonctionnalités
            proposées par le service.
          </p>
          <div className="grid">
            <section className="card">
              <h3>Pour les patients</h3>
              <p className="muted">
                Regrouper les informations disponibles, préparer les rendez-vous et retrouver
                plus facilement les éléments utiles à son suivi.
              </p>
            </section>
            <section className="card">
              <h3>Pour les professionnels de santé</h3>
              <p className="muted">
                Accéder aux informations autorisées par le patient afin de faciliter la
                préparation et la continuité des échanges lors des consultations.
              </p>
            </section>
            <section className="card">
              <h3>Pour les établissements</h3>
              <p className="muted">
                Disposer d’un cadre organisé pour rattacher les professionnels à leur structure
                et soutenir l’utilisation du service.
              </p>
            </section>
          </div>
        </section>

        <section className="stack" aria-labelledby="creation">
          <h2 id="creation">Un projet construit à plusieurs compétences</h2>
          <p>
            E-Carnet est porté par la startup Redianice et développé grâce à une équipe
            pluridisciplinaire. Le projet réunit des compétences en développement numérique,
            en droit et en conformité juridique, en pilotage de projet ainsi qu’en design
            graphique. Cette collaboration vise à faire avancer ensemble l’utilité du service,
            son cadre juridique et la clarté de son identité visuelle.
          </p>
          <p>
            La réalisation technique est assurée par le fondateur d’AKATech Studio, qui
            contribue au projet au sein de cette collaboration. Deux graphistes participent
            au branding, au logo et à l’identité visuelle, tandis que le volet juridique et le
            pilotage sont accompagnés par les membres concernés de l’équipe.
          </p>
          <p className="muted">
            Pour découvrir les contributions de l’équipe et les outils utilisés, consultez les
            <Link href="/credits"> crédits du projet</Link>.
          </p>
        </section>

        <p className="actions">
          <Link className="button" href="/aide">Centre d’aide</Link>
          <Link className="button" href="/securite">Sécurité et accès</Link>
        </p>
      </article>
    </PublicShell>
  );
}
