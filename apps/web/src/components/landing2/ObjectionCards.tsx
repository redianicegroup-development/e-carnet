import Link from "next/link";

/** Objections : les quatre doutes les plus fréquents avant de commencer, traités avant la démonstration et la FAQ.
 *  Chiffres alignés sur le centre d'aide : QR de 5 minutes, accès de 2 heures, lecture hors connexion de 7 jours au plus pour les données du compte. */
export function ObjectionCards() {
  return (
    <>
      <div className="lp2-head lp2-rv">
        <h2 id="objections-title">Avant de vous lancer</h2>
        <p className="lp2-lead">Les quatre doutes qu’on entend le plus, et ce qu’il en est.</p>
      </div>
      <div className="lp2-objs">
        <article className="lp2-obj lp2-rv">
          <h3>« Le médecin va-t-il tout voir ? »</h3>
          <p>Non. Il ne lit que le contenu prévu pour la consultation. Votre QR est valable 5 minutes et ne sert qu’une fois, puis l’accès dure 2 heures.</p>
        </article>
        <article className="lp2-obj lp2-rv">
          <h3>« Je ne suis pas à l’aise avec le numérique. »</h3>
          <p>Commencez par l’essentiel : vos allergies et vos traitements. Chaque écran fait une seule chose, et le reste du carnet peut venir plus tard.</p>
        </article>
        <article className="lp2-obj lp2-rv">
          <h3>« Et si je n’ai pas de réseau ? »</h3>
          <p>Vous relisez en lecture seule ce que vous avez déjà consulté, jusqu’à 7 jours pour les données de votre compte. Toute modification demande la connexion.</p>
        </article>
        <article className="lp2-obj lp2-rv">
          <h3>« Mes informations sont-elles protégées ? »</h3>
          <p>
            Le service applique les mesures décrites dans les pages Sécurité et Confidentialité. Vous décidez des accès, et chacun reste dans votre historique.
            {" "}
            <Link href="/securite">Voir la page Sécurité</Link>
          </p>
        </article>
      </div>
    </>
  );
}
