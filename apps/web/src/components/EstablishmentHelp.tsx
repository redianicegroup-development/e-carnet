import Link from "next/link";
import { HelpContact, HelpFaq, HelpGlossary, HelpNotices, HelpSteps, HelpTroubleshooting } from "./help/HelpCenter";
import { ESTABLISHMENT_STEPS } from "./help/helpContent";
import { PageHeader } from "./ui/PageHeader";

export function EstablishmentHelp() {
  return (
    <div className="stack-lg help">
      <PageHeader eyebrow="Aide" title="Comment ça fonctionne" lead="Quatre étapes, de l’ouverture de votre établissement à l’arrivée de vos médecins." />
      <HelpNotices />
      <HelpSteps steps={ESTABLISHMENT_STEPS} />
      <section className="card">
        <span className="eyebrow">Ce que vous ne faites pas</span>
        <h2>Aucun accès aux dossiers</h2>
        <p className="muted">L’administrateur gère les rattachements. Il ne consulte pas les dossiers médicaux. Le partage de dossier entre établissements n’est pas disponible dans cette version.</p>
        <div className="actions"><Link className="button" href="/securite">Notre approche de la sécurité</Link><Link className="button" href="/aide#patient">Guides patient et professionnel</Link></div>
      </section>
      <section className="stack" aria-labelledby="aide-questions">
        <h2 id="aide-questions">Questions fréquentes</h2>
        <HelpFaq profile="establishment" groupTitles={false} />
      </section>
      <section className="stack" aria-labelledby="aide-depannage">
        <h2 id="aide-depannage">Un problème ?</h2>
        <HelpTroubleshooting profile="establishment" />
      </section>
      <section className="stack" aria-labelledby="aide-glossaire">
        <h2 id="aide-glossaire">Les mots du carnet</h2>
        <HelpGlossary />
      </section>
      <HelpContact />
    </div>
  );
}
