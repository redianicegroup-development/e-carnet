import Image from "next/image";
import { PROBLEM_IMAGE } from "../../lib/landing-content";

/** Problème : les gênes concrètes d'une consultation sans carnet à jour. Bande pleine largeur au même fond crème que le reste de la page, trois constats en lignes (pas de cartes), et une photo : paysage sur ordinateur, portrait sur mobile. */
export function ProblemSection() {
  return (
    <div className="lp2-problem">
      <div className="lp2-problem-in">
        <div className="lp2-problem-head lp2-rv">
          <h2 id="problem-title">Chaque consultation repart de zéro.</h2>
          <p>Papiers égarés, histoire à répéter, informations éparpillées : le temps du rendez-vous passe à reconstituer ce que vous savez déjà.</p>
          <figure className="lp2-problem-photo lp2-rv">
            <picture>
              <source media="(max-width: 759px)" srcSet={PROBLEM_IMAGE.mobileSrc} />
              <Image src={PROBLEM_IMAGE.desktopSrc} alt={PROBLEM_IMAGE.alt} width={PROBLEM_IMAGE.desktopWidth} height={PROBLEM_IMAGE.desktopHeight} sizes="(max-width: 759px) 92vw, (max-width: 900px) 86vw, 480px" />
            </picture>
          </figure>
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
