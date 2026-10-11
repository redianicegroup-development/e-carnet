import Link from "next/link";

export function EstablishmentHelp() {
  return <section className="card stack">
    <span className="eyebrow">Aide établissement</span>
    <h2>Gérer les rattachements</h2>
    <p className="muted">Retrouvez les étapes pour ouvrir un espace, inviter un responsable et gérer les médecins rattachés.</p>
    <div className="actions"><Link className="button primary" href="/aide#etablissements">Ouvrir le centre d’aide</Link><Link className="button" href="/securite">Sécurité</Link></div>
  </section>;
}
