import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "../../components/public/PublicShell";

export const metadata: Metadata = {
  title: "Centre d’aide — Mon E-Carnet",
  description: "Guides pratiques pour le carnet patient, les professionnels, les établissements, le compte et la sécurité.",
  robots: { index: true, follow: true },
};

const sections = [
  {
    id: "patient", title: "Patient", items: [
      ["Créer mon carnet", "Depuis Connexion, choisissez « Nouveau compte ». Après l’inscription, complétez votre identité puis ouvrez votre espace patient."],
      ["Ajouter une information de santé", "Dans Mon carnet, ajoutez une déclaration et indiquez sa source. Une déclaration personnelle n’est pas présentée comme un diagnostic confirmé."],
      ["Préparer une consultation", "Ouvrez Préparer une consultation, décrivez votre motif et vos informations utiles, puis enregistrez votre préparation."],
      ["Partager mon carnet", "Présentez le QR temporaire au professionnel. Vérifiez sa demande, son périmètre et sa durée avant d’autoriser l’accès. Vous pouvez le révoquer à tout moment."],
      ["Retrouver mes accès", "L’historique indique les demandes, décisions et accès associés à votre carnet."],
    ],
  },
  {
    id: "professionnels", title: "Professionnel de santé", items: [
      ["Compléter mon profil", "Après la création du compte, indiquez vos informations professionnelles. Les options de rattachement dépendent de l’établissement."],
      ["Rejoindre un établissement", "Demandez à l’établissement un code d’invitation, saisissez-le dans votre espace, puis attendez sa décision."],
      ["Demander l’accès à un patient", "Lancez une demande et indiquez le périmètre requis. Le patient doit l’autoriser avant toute consultation du carnet."],
      ["Préparer ou suivre une consultation", "Les informations disponibles dépendent de l’autorisation accordée par le patient. Les actions enregistrées sont associées à leur auteur."],
    ],
  },
  {
    id: "etablissements", title: "Établissement", items: [
      ["Ouvrir un espace", "L’ouverture est gérée par l’équipe Mon E‑Carnet. Écrivez-nous depuis le formulaire de contact de l’accueil, objet « Ouvrir un espace établissement »."],
      ["Inviter un médecin", "Depuis Médecins, générez un code à usage unique et transmettez-le directement au médecin."],
      ["Traiter une demande", "Dans Demandes, vérifiez le profil puis acceptez ou refusez le rattachement. L’espace établissement ne donne pas accès aux carnets patients."],
    ],
  },
  {
    id: "compte", title: "Compte et préférences", items: [
      ["Connexion ou inscription", "Une seule page sert à entrer dans Mon E‑Carnet. Choisissez « J’ai déjà un compte » ou « Nouveau compte », puis utilisez l’email ou un fournisseur proposé."],
      ["Nom et photo", "Dans Paramètres → Informations personnelles, modifiez votre nom ou sélectionnez une nouvelle photo d’avatar."],
      ["Thème", "Le thème choisi dans Paramètres du compte est enregistré avec votre compte et suit votre connexion sur vos appareils."],
      ["Sécurité et déconnexion", "Les fournisseurs de connexion se gèrent dans Sécurité et connexion. Le bouton Déconnexion est disponible dans chaque espace."],
    ],
  },
  {
    id: "confidentialite", title: "Données et confidentialité", items: [
      ["Accès au carnet", "Un professionnel ne consulte le carnet qu’après le rattachement requis et l’autorisation explicite du patient. L’établissement gère les rattachements, pas les dossiers."],
      ["QR temporaire", "Le QR sert à initier une demande d’accès et expire automatiquement. Il ne remplace pas la décision du patient."],
      ["Données de fréquentation", "Un cookie aléatoire aide à compter les catégories de pages, certains clics publics et des événements de connexion. Le suivi ne conserve ni URL complète, ni adresse IP, ni texte de bouton."],
      ["Environnement d’essai", "Utilisez des informations exactes et gardez votre compte personnel."],
    ],
  },
  {
    id: "retours", title: "Questions et retours", items: [
      ["J’ai une question", "Pour une question qui appelle une réponse, utilisez le formulaire de contact de l’accueil. Pour une suggestion ou un problème, envoyez un retour depuis le bouton flottant Votre avis."],
      ["Enquêtes d’amélioration", "Une enquête courte peut apparaître après cinq pages publiques. Une seconde enquête est proposée une fois après une première action réussie dans un espace connecté."],
      ["Confidentialité des retours", "Les retours et réponses d’enquête sont pseudonymes ou anonymes côté administration. N’y indiquez aucun nom, identifiant ou renseignement médical."],
    ],
  },
];

export default function HelpPage() {
  return <PublicShell><article className="hero-page help-page">
    <span className="eyebrow">Centre d’aide</span>
    <h1>Besoin d’un repère ?</h1>
    <p className="lead">Choisissez votre espace ou votre sujet. Les réponses essentielles sont ici.</p>
    <nav className="help-quicklinks" aria-label="Rubriques d’aide">{sections.map((section) => <a className="button small" key={section.id} href={`#${section.id}`}>{section.title}</a>)}</nav>
    <aside className="notice help-data-note" role="note"><strong>Données de santé :</strong> utilisez des informations exactes et gardez votre compte personnel.</aside>
    {sections.map((section) => <section className="card help-section" id={section.id} key={section.id}>
      <h2>{section.title}</h2>
      <div className="help-accordion">{section.items.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
    </section>)}
    <section className="card help-section" id="questions"><h2>Accéder rapidement</h2><div className="actions"><Link className="button primary" href="/connexion">Connexion ou inscription</Link><Link className="button" href="/securite">Sécurité</Link><Link className="button" href="/a-propos">À propos</Link></div></section>
  </article></PublicShell>;
}
