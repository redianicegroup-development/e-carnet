import Link from "next/link";
import { DATA_POLICY } from "../../lib/data-policy";
import type { Metadata } from "next";
import { BrandMark } from "../../components/ui/BrandMark";

export const metadata: Metadata = {
  title: "Périmètre et état du projet — Mon E-Carnet",
  description: "Aperçu du périmètre présent dans le code Mon E-Carnet et des validations qui restent à faire.",
  robots: { index: false, follow: false },
};

const included = [
  "Comptes nominatifs avec authentification par session serveur ; la configuration de référence garde la session après fermeture de la PWA, jusqu’à 7 jours sans activité (30 minutes pour les comptes professionnels et établissement).",
  "Espaces patient, professionnel et établissement avec contrôle des autorisations côté API.",
  "Carnet patient, déclarations, documents, consultations, vaccinations, mesures, rendez-vous, rappels et plans de suivi selon les rôles et autorisations disponibles.",
  "Carte d’urgence virtuelle, QR public activé par le patient et téléchargement PNG ; les informations restent des déclarations et doivent être vérifiées par les professionnels.",
  "Navigation hors connexion en lecture seule : cache des lectures d’API chiffré sur l’appareil, avec des durées limitées ; aucune écriture n’est mise en attente.",
  DATA_POLICY.v1Scope,
];

const limitations = [
  "Les données de santé réelles ne sont pas autorisées : le service reste en phase de test avec des données fictives.",
  "L’accès clinique des administrateurs d’établissement est désactivé par défaut ; les modèles d’environnement du dépôt le fixent à false. La décision juridique sur le rôle habilité et le parcours d’ouverture restent à valider.",
  "ETA-13 (plusieurs administrateurs avec rôles propriétaire/gestionnaire) n’est pas implémenté : le code conserve le modèle existant d’administrateur d’établissement.",
  "La copie hors connexion des lectures d’API est chiffrée, mais la copie séparée de la carte d’urgence ouverte par QR est conservée jusqu’à 24 heures dans IndexedDB sans chiffrement applicatif. Utilisez cette carte uniquement sur un appareil de confiance.",
  "Le mode faible débit PAT-21 et les essais avec cinq personnes sur de vrais appareils (dont une personne âgée) ne sont pas déclarés comme réalisés.",
  "Le déploiement, la recette staging, la validation indépendante de sécurité et les validations médicales/juridiques ne sont pas établis par la présence du code.",
];

const flows = [
  { title: "Patient", href: "/patient", text: "Carnet et paramètres du compte, lorsque l’environnement est disponible." },
  { title: "Professionnel", href: "/professionnel", text: "Parcours professionnel avec autorisations patient et rattachements actifs." },
  { title: "Établissement", href: "/etablissement", text: "Espace établissement ; l’accès clinique administratif reste fermé par défaut." },
  { title: "Aide", href: "/aide", text: "Réponses sur la connexion, les sessions et le mode hors connexion." },
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
          <Link href="/connexion" className="button primary small">Se connecter</Link>
        </div>
      </header>

      <section className="hero hero-page">
        <span className="eyebrow">V1 — état du périmètre</span>
        <h1>Un projet en construction, avec des limites explicites.</h1>
        <p className="muted">
          Cette page décrit des fonctions présentes dans le dépôt, pas une mise en production ni une autorisation
          d’utiliser des données de santé réelles. Les validations opérationnelles, médicales, juridiques et de sécurité
          restent distinctes du code.
        </p>
        <div className="actions">
          <Link href="/connexion" className="button primary">Se connecter</Link>
          <Link href="/securite" className="button">Lire les informations de sécurité</Link>
          <Link href="/aide" className="button">Consulter l’aide</Link>
        </div>
      </section>

      <section className="grid" aria-label="Espaces de l’application">
        {flows.map((flow) => (
          <Link key={flow.title} href={flow.href} className="card" style={{ textDecoration: "none" }}>
            <span className="eyebrow">{flow.title}</span>
            <h2>{flow.title}</h2>
            <p className="muted">{flow.text}</p>
          </Link>
        ))}
      </section>

      <section className="grid" aria-label="Périmètre et limites" style={{ marginTop: 24 }}>
        <article className="card">
          <h2>Fonctions présentes dans le code</h2>
          <ul>{included.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
        <article className="card">
          <h2>Limites et validations en attente</h2>
          <ul>{limitations.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
      </section>

      <section className="card" style={{ marginTop: 24 }}>
        <h2>Connexion et mode hors connexion</h2>
        <p className="muted">
          Sans déconnexion explicite, le cookie de session persiste après fermeture de la PWA selon la durée réglée
          pour l’environnement (7 jours sans activité dans les configurations de référence). Une connexion Internet
          reste nécessaire pour interroger le serveur. Sans réseau, seuls les écrans et les lectures déjà enregistrés
          localement peuvent s’ouvrir en lecture seule, jusqu’à leur expiration.
        </p>
      </section>

      <footer className="footer">
        Mon E-Carnet est en phase de test. Seules des données fictives sont autorisées dans l’état documenté du projet.
      </footer>
    </main>
  );
}
