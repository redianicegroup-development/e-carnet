import Link from "next/link";

export const metadata = {
  title: "Conditions de rattachement médecin — Mon E-Carnet",
  robots: { index: false, follow: false },
};

export default function ConditionsRattachementPage() {
  return (
    <main className="hero-page">
      <Link className="button" href="/professionnel/acces">← Retour au rattachement</Link>
      <span className="eyebrow">Rattachement professionnel</span>
      <h1>Engagement de rattachement médecin</h1>
      <p className="notice">Projet fonctionnel à faire valider par un conseil juridique avant tout usage contractuel réel. Ce texte ne remplace pas le contrat complet entre l’établissement et le médecin.</p>
      <section className="card">
        <h2>En saisissant le code médecin, je m’engage à</h2>
        <ol>
          <li>Protéger les informations non publiques de l’établissement et ne pas les divulguer à des personnes non autorisées, sauf obligation légale ou autorisation documentée.</li>
          <li>Préserver la confidentialité des patients et n’accéder à leurs informations que dans le cadre de ma mission, avec les autorisations et consentements requis.</li>
          <li>Saisir des informations médicales de bonne foi et exactes, distinguer les déclarations du patient des constatations professionnelles, et ne pas inventer, altérer ou falsifier un diagnostic, une consultation, une attestation ou un dossier.</li>
          <li>Protéger mes moyens d’accès, ne pas partager mon compte, mon mot de passe ou mes codes personnels et signaler toute compromission présumée.</li>
          <li>Comprendre que l’établissement peut mettre fin au rattachement et que je peux également y mettre fin depuis mon espace privé. La fin du rattachement bloque les nouveaux accès cliniques dépendant de cette affiliation.</li>
          <li>Comprendre que cette fin n’efface pas les traces d’audit ni les consultations et documents déjà constitués ; leur conservation et leur accès demeurent soumis aux règles applicables et à la politique de conservation à approuver.</li>
        </ol>
        <h2>Ce que l’acceptation signifie dans l’application</h2>
        <p>Le serveur enregistre le médecin, l’établissement, la version acceptée et l’horodatage UTC lorsque le code est soumis. Sans acceptation explicite, le code n’est pas consommé. L’acceptation ne donne pas, à elle seule, accès aux dossiers patients : la demande doit être approuvée et les contrôles de consentement et d’autorisation clinique restent applicables.</p>
        <p className="muted">L’identité des parties, les responsabilités, la durée, les exceptions de confidentialité, les règles de conservation, la signature électronique et les exigences locales doivent être validées par un juriste avant production.</p>
        <p><Link href="/professionnel/acces">Revenir et accepter les conditions</Link></p>
      </section>
    </main>
  );
}
