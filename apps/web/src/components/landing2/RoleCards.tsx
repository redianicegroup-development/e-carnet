import Image from "next/image";
import { PROFILES } from "../../lib/landing-content";
import { RoleCta } from "./RoleCta";

const ICONS = [
  <svg key="p" className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></svg>,
  <svg key="m" className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4v6a4 4 0 0 0 8 0V4" /><circle cx="18" cy="16" r="3" /><path d="M14 10v2a4 4 0 0 0 1.2 2.9" /></svg>,
  <svg key="e" className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V5h9v15M14 10h5v10M3 20h18" /><path d="M8 9h3M8 13h3M8 17h3" /></svg>,
];

/** Rôles : le texte et la photo viennent de PROFILES (une seule source, comme les boutons : liens, suivi, objet du contact).
 *  Chaque carte est une photo carrée ; le texte et le bouton se posent par-dessus, sur un dégradé sombre qui part du bas. */
export function RoleCards() {
  return (
    <>
      <div className="lp2-head lp2-rv">
        <h2 id="roles-title">Un espace pour chacun</h2>
        <p className="lp2-lead">Le patient remet son carnet, le médecin le lit et conseille, l’établissement organise ses équipes.</p>
      </div>
      <div className="lp2-roles">
        {PROFILES.map((profile, index) => (
          <article key={profile.label} className="lp2-role lp2-rv" data-photo-card>
            {/* Photo : fond de la carte, carrée. Dévoilée au défilement (LandingMotion, via ScrollTrigger et Lenis) ; ouverte en entier au survol de la souris ou au focus clavier (CSS). Sans mouvement, elle est simplement affichée. */}
            <figure className="lp2-role__photo">
              <Image src={profile.photo.src} alt={profile.photo.alt} width={1200} height={1200} sizes="(max-width: 900px) 92vw, 380px" />
            </figure>
            <p className="lp2-role__badge">
              <span className={`lp2-orb${index === 1 ? " lp2-g" : ""}`}>{ICONS[index]}</span>
              <span className="lp2-label">{profile.label}</span>
            </p>
            <div className="lp2-role__body">
              <h3>{profile.title}</h3>
              <ul>
                {profile.points.map((point) => (
                  <li key={point}>
                    <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>
                    {" "}
                    {point}
                  </li>
                ))}
              </ul>
              <RoleCta index={index} />
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
