/** Problème : les gênes concrètes d'une consultation sans carnet à jour. Bande sombre pleine largeur, trois constats en lignes (pas de cartes). */
export function ProblemSection() {
  return (
    <div className="lp2-problem">
      <div className="lp2-problem-in">
        <div className="lp2-problem-head lp2-rv">
          <h2 id="problem-title">Chaque consultation repart de zéro.</h2>
          <p>Papiers égarés, histoire à répéter, informations éparpillées : le temps du rendez-vous passe à reconstituer ce que vous savez déjà.</p>
        </div>
        <ul className="lp2-pains">
          <li className="lp2-rv">
            <h3>Votre histoire, à raconter à chaque médecin</h3>
            <p>Allergies, traitements, antécédents : on vous les redemande à chaque rendez-vous, et un oubli est vite arrivé.</p>
          </li>
          <li className="lp2-rv">
            <h3>Des papiers dans tous les sens</h3>
            <p>Ordonnances, résultats, carnet de vaccination : dans un sac, dans un tiroir, dans une photo de téléphone. Au moment de consulter, impossible de tout retrouver.</p>
          </li>
          <li className="lp2-rv">
            <h3>Un médecin qui découvre tout sur place</h3>
            <p>Sans votre historique sous les yeux, la consultation commence par des questions, pas par des préconisations.</p>
          </li>
        </ul>
      </div>
    </div>
  );
}
