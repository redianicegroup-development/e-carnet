import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "../../components/public/PublicShell";

export const metadata: Metadata = { title: "À propos — Mon Carnet Numérique", description: "Un carnet de santé personnel pour préparer les consultations et garder ses informations organisées.", robots: { index: true, follow: true } };

export default function AboutPage() {
  return <PublicShell><article className="hero-page">
    <span className="eyebrow">À propos</span>
    <h1>Votre carnet, sous votre contrôle.</h1>
    <p className="lead">E‑Carnet aide à organiser les informations de santé, préparer les consultations et choisir les accès au carnet.</p>
    <div className="grid">
      <section className="card"><h2>Pour les patients</h2><p className="muted">Préparez vos rendez-vous et gardez vos informations au même endroit.</p></section>
      <section className="card"><h2>Pour les professionnels</h2><p className="muted">Consultez uniquement les informations autorisées par le patient.</p></section>
      <section className="card"><h2>Pour les établissements</h2><p className="muted">Gérez les rattachements des professionnels de votre structure.</p></section>
    </div>
    <p className="actions"><Link className="button" href="/aide">Centre d’aide</Link><Link className="button" href="/securite">Sécurité</Link></p>
  </article></PublicShell>;
}
