export function StaffProfessionalVerification() {
  return (
    <section className="hero-page">
      <header className="page-header">
        <span className="eyebrow">Équipe Mon Carnet Numérique</span>
        <h1>Vérification interne des médecins</h1>
        <p className="lead">E‑Carnet ne collecte pas et ne valide pas les justificatifs médicaux individuels. La vérification du médecin et de ses pièces est effectuée en interne par l’établissement.</p>
      </header>
      <div className="card">
        <h2>Rôle de l’application</h2>
        <ol className="checklist">
          <li><span className="checklist__mark">1</span><div><strong>Demande d’établissement</strong><br /><span>L’établissement envoie ses informations et preuves par e-mail à l’équipe E‑Carnet.</span></div></li>
          <li><span className="checklist__mark">2</span><div><strong>Examen hors application</strong><br /><span>L’équipe examine les preuves de l’établissement hors de l’application.</span></div></li>
          <li><span className="checklist__mark">3</span><div><strong>Création, activation et invitation</strong><br /><span>Après validation, l’équipe crée l’établissement et son administrateur nominatif, puis lui remet une invitation personnelle à usage unique valable 48 h.</span></div></li>
          <li><span className="checklist__mark">4</span><div><strong>Vérification médicale interne et rattachement</strong><br /><span>L’établissement vérifie le médecin selon ses procédures internes. Son administrateur enregistre la décision d’adhésion; E‑Carnet journalise ce rattachement sans vérifier les justificatifs médicaux.</span></div></li>
        </ol>
        <p className="notice">Le statut de spécialité visible dans E‑Carnet est déclaratif. Il ne constitue pas une attestation ni une vérification médicale par E‑Carnet.</p>
      </div>
    </section>
  );
}
