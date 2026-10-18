import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "../../components/public/PublicShell";

export const metadata: Metadata = { title: "Sécurité — Mon E-Carnet", description: "Accès au carnet, consentement patient et protection des données.", robots: { index: true, follow: true } };

export default function SecurityPage() {
  return <PublicShell><article className="hero-page">
    <span className="eyebrow">Sécurité et confidentialité</span>
    <h1>Le patient garde la maîtrise des accès.</h1>
    <p className="lead">Un professionnel doit être rattaché à son établissement et recevoir l’autorisation du patient avant de consulter le carnet.</p>
    <div className="grid">
      <section className="card"><h2>Accès limités</h2><p className="muted">Le patient voit le périmètre et la durée, et peut retirer son autorisation.</p></section>
      <section className="card"><h2>Historique</h2><p className="muted">Les demandes et décisions d’accès sont conservées dans le carnet.</p></section>
      <section className="card"><h2>Suivi du site</h2><p className="muted">Les statistiques utilisent des catégories de page et des clics publics, sans conserver les URL complètes ni les adresses IP.</p></section>
    </div>
    <aside className="notice help-data-note"><strong>Informations importantes :</strong> utilisez des informations exactes et gardez votre compte personnel. Mon E‑Carnet ne remplace pas un avis médical ni les services d’urgence.</aside>
    <p className="actions"><Link className="button" href="/aide#donnees">Détails sur les données</Link><Link className="button" href="/aide">Centre d’aide</Link></p>
  </article></PublicShell>;
}
