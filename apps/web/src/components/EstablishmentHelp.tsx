import Link from "next/link";
import { PageHeader } from "./ui/PageHeader";
import { Icon } from "./ui/Icon";

const STEPS = [
  { icon: "mail", title: "Votre établissement est ouvert par notre équipe", text: "Vous nous écrivez avec les informations de l’établissement. Nous créons votre accès administrateur et vous envoyons une invitation personnelle valable 48 h." },
  { icon: "lock", title: "Vous activez votre compte", text: "Depuis l’invitation, vous choisissez votre mot de passe. L’accès est nominatif : il n’existe pas de compte partagé." },
  { icon: "link", title: "Vous remettez un code à chaque médecin", text: "Un code à usage unique, valable 48 h. Le médecin le saisit dans son espace et vous recevez sa demande." },
  { icon: "check", title: "Vous confirmez le rattachement", text: "Le médecin devient actif sous votre établissement. Il ne voit un carnet que si le patient l’y autorise." },
] as const;

export function EstablishmentHelp() {
  return (
    <div className="stack-lg">
      <PageHeader eyebrow="Aide" title="Comment ça fonctionne" lead="Quatre étapes, de l’ouverture de votre établissement à l’arrivée de vos médecins." />
      <ol className="stack" style={{ listStyle: "none", padding: 0 }}>
        {STEPS.map((step, index) => (
          <li key={step.title} className="list-row" style={{ alignItems: "flex-start" }}>
            <span className="setting-item__icon"><Icon name={step.icon} /></span>
            <span className="list-row__body"><strong>{index + 1}. {step.title}</strong><br /><span className="muted">{step.text}</span></span>
          </li>
        ))}
      </ol>
      <section className="card">
        <span className="eyebrow">Ce que vous ne faites pas</span>
        <h2>Aucun accès aux dossiers</h2>
        <p className="muted">L’administrateur gère les rattachements. Il ne consulte pas les dossiers médicaux. Le partage de dossier entre établissements n’est pas disponible dans cette version.</p>
        <div className="actions"><Link className="button" href="/securite">Notre approche de la sécurité</Link><Link className="button" href="/faq">Questions fréquentes</Link></div>
      </section>
    </div>
  );
}
