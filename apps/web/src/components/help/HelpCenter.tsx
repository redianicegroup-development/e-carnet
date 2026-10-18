import Link from "next/link";
import { ContactLine } from "../public/ContactLine";
import { HelpBrowser } from "./HelpBrowser";
import { HelpNotices } from "./HelpParts";

/* Les morceaux de l'aide restent importables d'ici (EstablishmentHelp, dans l'espace établissement). */
export { HelpFaq, HelpGlossary, HelpNotices, HelpSteps, HelpTroubleshooting } from "./HelpParts";

export function HelpContact() {
  return (
    <section className="card help__contact" aria-labelledby="aide-contact">
      <h2 id="aide-contact">Une question qui n’est pas ici ?</h2>
      <p className="muted">Écrivez-nous en décrivant ce que vous avez fait et ce que vous voyez à l’écran. N’y joignez aucune information de santé.</p>
      <p><ContactLine /></p>
      <div className="actions">
        <Link className="button primary" href="/#contact">Nous écrire</Link>
        <Link className="button" href="/securite">Sécurité</Link>
        <Link className="button" href="/confidentialite">Confidentialité</Link>
        <Link className="button" href="/cgu">Conditions d’utilisation</Link>
        <Link className="button ghost" href="/credits">Crédits</Link>
      </div>
    </section>
  );
}

/** Centre d'aide unique : recherche, choix du profil, parcours pas à pas, questions, dépannage, glossaire, contact. */
export function HelpCenter() {
  return (
    <div className="stack-lg help">
      <header className="help__head">
        <h1>Centre d’aide</h1>
        <p className="lead">Des guides pas à pas, des réponses sans jargon et de quoi dépanner. Cherchez un mot ou choisissez votre profil.</p>
      </header>
      <HelpNotices />
      <HelpBrowser />
      <HelpContact />
    </div>
  );
}
