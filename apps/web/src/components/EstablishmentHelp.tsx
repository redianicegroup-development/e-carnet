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
        <span className="eyebrow">Accès aux dossiers</span>
        <h2>Un périmètre propre à chaque rôle</h2>
        <p className="muted">L’administrateur consulte les dossiers ayant une pré-consultation clôturée ou une consultation dans son établissement. Le professionnel n’accède qu’au dossier de son cas attribué, selon l’autorisation du patient. Aucun accès automatique aux données d’un autre établissement.</p>
        <div className="actions"><Link className="button" href="/etablissement/dossiers">Voir les dossiers de l’établissement</Link><Link className="button" href="/securite">Notre approche de la sécurité</Link></div>
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
