import Link from "next/link";
import type { Metadata } from "next";
import { BrandMark } from "../../components/ui/BrandMark";

export const metadata: Metadata = {
  title: "V1 — Cœur sûr et utilisable | Mon E-Carnet",
  description: "Vue d’ensemble de la V1 stable du produit : sécurité, consentement, traçabilité et parcours patient/professionnel restreints.",
  robots: { index: false, follow: false },
};

const included = [
  "Inscription et connexion sécurisées avec sessions serveur",
  "Onboarding patient et professionnel en parcours guidé",
  "Vérification de contexte, rattachement et établissement actif",
  "Consentement patient via AccessGrant limité dans le temps",
  "Pré-consultation clôturée par le médecin et consultation professionnelle traçable",
  "Audit des accès et des décisions sensibles",
  "Isolation stricte entre établissements et donnée fictive uniquement",
];

const excluded = [
  "MFA TOTP (reporté en V3)",
  "OTP SMS (reporté en V3)",
  "Partage inter-établissements (V3)",
  "Comptes infirmiers ou espace infirmier autonome",
  "Ordonnances structurées, IA et fonctions cliniques avancées",
];

const readiness = [
  "Le patient reste titulaire de son carnet.",
  "Le professionnel ne voit aucune donnée sans autorisation explicite.",
  "L’établissement actif est vérifié côté serveur pour chaque action clinique.",
  "Les accès sont temporaires, limités et audités.",
  "La V1 est prête à être présentée comme socle fiable et utilisable.",
];

const flows = [
  { title: "Patient", href: "/patient", text: "Carnet, pré-consultation, consentement et historique client." },
  { title: "Professionnel", href: "/professionnel", text: "Profil, vérification, établissement actif et demandes d’accès." },
  { title: "V1", href: "/v1", text: "Positionnement produit, périmètre et critères de présentation." },
  { title: "Connexion", href: "/connexion", text: "Accès rapide au parcours principal pour démonstration." },
];

export default function V1Page() {
  return (
    <main className="shell">
      <header className="topbar">
        <p className="brand">
          <BrandMark />
          Mon E-Carnet
        </p>
        <div className="header-links">
          <Link href="/" className="button small">Accueil</Link>
          <Link href="/inscription" className="button primary small">Créer mon carnet</Link>
        </div>
      </header>

      <section className="hero hero-page">
        <span className="eyebrow">V1 — Cœur sûr et utilisable</span>
        <h1>Un socle fiable pour un usage pilotable.</h1>
        <p className="muted">
          La V1 n’est pas un produit complet de santé. Elle est la base sûre du système : consentement,
          sécurité, traçabilité et autorisation du patient avant tout accès clinique.
        </p>
        <div className="actions">
          <Link href="/connexion" className="button primary">Se connecter</Link>
          <Link href="/patient" className="button">Voir le parcours patient</Link>
          <Link href="/professionnel" className="button">Voir le parcours pro</Link>
        </div>
      </section>

      <section className="grid" aria-label="Parcours V1">
        {flows.map((flow) => (
          <Link key={flow.title} href={flow.href} className="card" style={{ textDecoration: "none" }}>
            <span className="eyebrow">{flow.title}</span>
            <h2>{flow.title}</h2>
            <p className="muted">{flow.text}</p>
          </Link>
        ))}
      </section>

      <section className="grid" aria-label="Contenu de la V1" style={{ marginTop: 24 }}>
        <article className="card">
          <h2>Ce qui est inclus</h2>
          <ul>
            {included.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="card">
          <h2>Ce qui est hors scope</h2>
          <ul>
            {excluded.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="card" style={{ marginTop: 24 }}>
        <h2>Critères de présentation</h2>
        <ul>
          {readiness.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="card" style={{ marginTop: 24 }}>
        <h2>Positionnement produit</h2>
        <p className="muted">
          La V1 est conçue pour démontrer un cœur de confiance opérationnel : le patient garde la maîtrise du
          carnet, le professionnel n’accède à des données que s’il est vérifié, rattaché à un établissement actif et
          autorisé par le patient. Toute lecture ou validation reste auditable.
        </p>
      </section>

      <footer className="footer">
        V1 stable et utilisable — socle sécurisé, consentement explicite, traçabilité et données fictives uniquement.
      </footer>
    </main>
  );
}
