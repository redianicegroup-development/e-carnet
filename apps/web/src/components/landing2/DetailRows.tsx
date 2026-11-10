import { MaskedEmergencyCard } from "./MaskedEmergencyCard";

/** Rangées sous les tuiles : carte d’urgence (vraie carte, valeurs masquées) et proches et enfants. */
export function DetailRows() {
  return (
    <>
      <div className="lp2-rows">
        <div className="lp2-row lp2-flip">
          <div className="lp2-copy lp2-rv">
            <h2>Une carte d’urgence, prête quand il le faut</h2>
            <p className="lp2-lead">Activez un QR public qui ouvre votre carte d’urgence, ou téléchargez-la en image PNG. Les éléments sont déclarés par vous et doivent être vérifiés par les professionnels.</p>
            <ul className="lp2-ticks">
              <li>
                <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>
                {" "}
                Le QR public est activé par vous
              </li>
              <li>
                <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>
                {" "}
                Téléchargement de la carte en PNG
              </li>
              <li>
                <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>
                {" "}
                Un proche de confiance peut lire votre fiche d’urgence
              </li>
            </ul>
            <p className="lp2-note">
              <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17v.01" /></svg>
              <span>À savoir : la carte ouverte par QR est conservée jusqu’à 24 h sur l’appareil qui la consulte. Utilisez un appareil de confiance.</span>
            </p>
          </div>
          <div className="lp2-stage lp2-green lp2-rv">
            <MaskedEmergencyCard />
          </div>
        </div>
        <div className="lp2-row">
          <div className="lp2-copy lp2-rv">
            <h2>Un carnet par enfant, une fiche d’urgence pour vos proches.</h2>
            <p className="lp2-lead">Un proche de confiance lit votre fiche d’urgence, rien de plus. Un enfant a son propre carnet, distinct du vôtre.</p>
            <ul className="lp2-ticks">
              <li>
                <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>
                {" "}
                Un mot de rattachement temporaire, à usage unique
              </li>
              <li>
                <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>
                {" "}
                Lecture seule : votre proche ne modifie rien
              </li>
              <li>
                <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>
                {" "}
                Quand vous agissez au nom d’un enfant, vos actions sont journalisées
              </li>
            </ul>
          </div>
          <div className="lp2-stage lp2-rv">
            <div className="lp2-stack">
              <div className="lp2-pcard">
                <h4>
                  <span className="lp2-orb lp2-g" style={{ width: "40px", height: "40px", borderRadius: "12px" }}>
                    <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.8c1.7.8 3 2.5 3 5.2" /></svg>
                  </span>
                  <span>
                    Proche de confiance
                    <br />
                    <span className="lp2-tag">Lecture seule</span>
                  </span>
                </h4>
                <div className="lp2-mot">
                  <span>•••• ••••</span>
                  <small>Valable 72 h</small>
                </div>
                <ul>
                  <li>Lit votre fiche d’urgence</li>
                  <li>Ne peut ni modifier ni générer votre QR</li>
                </ul>
              </div>
              <div className="lp2-pcard">
                <h4>
                  <span className="lp2-orb" style={{ width: "40px", height: "40px", borderRadius: "12px" }}>
                    <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></svg>
                  </span>
                  <span>
                    Profil enfant
                    <br />
                    <span className="lp2-tag">Dossier distinct</span>
                  </span>
                </h4>
                <ul>
                  <li>Un carnet propre, avec son historique</li>
                  <li>Vous choisissez quel dossier vous ouvrez</li>
                  <li>Le lien de représentation peut être retiré</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
