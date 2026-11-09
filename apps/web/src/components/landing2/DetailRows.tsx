import { FakeQr } from "./FakeQr";

/** Généré depuis la maquette (carnet, carte d’urgence, proches et enfants). */
export function DetailRows() {
  return (
    <>
      <div className="lp2-rows">
        <div className="lp2-row">
          <div className="lp2-copy lp2-rv">
            <h2>Chaque information dit d’où elle vient.</h2>
            <p className="lp2-lead">Vos antécédents, allergies et traitements sont marqués « Déclaré par le patient ». On distingue d’un coup d’œil ce qui vient de vous et ce qui vient d’un professionnel.</p>
            <ul className="lp2-ticks">
              <li>
                <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>
                {" "}
                Antécédents, allergies et traitements au même endroit
              </li>
              <li>
                <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>
                {" "}
                Documents, mesures et vaccinations rangés par thème
              </li>
              <li>
                <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>
                {" "}
                Un carnet prêt à être remis au médecin à chaque consultation
              </li>
            </ul>
          </div>
          <div className="lp2-stage lp2-rv">
            <div className="lp2-phone">
              <div className="lp2-scr">
                <span className="lp2-notch" />
                <div className="lp2-ap-bar">
                  <span>
                    <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h5l2 2h9v10H4z" /></svg>
                    Carnet
                  </span>
                  <i className="lp2-ap-av">EC</i>
                </div>
                <div className="lp2-ap-body">
                  <p className="lp2-ap-title">Mon carnet</p>
                  <div className="lp2-ap-card">
                    <div className="lp2-ap-row">
                      <b>Allergies</b>
                      <span className="lp2-chip lp2-dec">Déclaré par le patient</span>
                    </div>
                    <small>Pénicilline</small>
                  </div>
                  <div className="lp2-ap-card">
                    <div className="lp2-ap-row">
                      <b>Antécédents</b>
                      <span className="lp2-chip lp2-dec">Déclaré par le patient</span>
                    </div>
                    <small>Asthme léger</small>
                  </div>
                  <div className="lp2-ap-card">
                    <div className="lp2-ap-row">
                      <b>Traitements</b>
                      <span className="lp2-chip lp2-dec">Déclaré par le patient</span>
                    </div>
                    <small>Salbutamol, au besoin</small>
                  </div>
                  <div className="lp2-ap-card">
                    <div className="lp2-ap-row">
                      <b>Tension</b>
                      <span className="lp2-chip lp2-me">Mesuré</span>
                    </div>
                    <small>12/8, ce matin</small>
                  </div>
                </div>
                <div className="lp2-ap-tabs">
                  <span>
                    <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11 12 4l8 7" /><path d="M6 10v9h12v-9" /><path d="M10 19v-5h4v5" /></svg>
                    Accueil
                  </span>
                  <span className="lp2-on">
                    <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h5l2 2h9v10H4z" /></svg>
                    Carnet
                  </span>
                  <span>
                    <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4v6a4 4 0 0 0 8 0V4" /><circle cx="18" cy="16" r="3" /><path d="M14 10v2a4 4 0 0 0 1.2 2.9" /></svg>
                    Consult.
                  </span>
                  <span>
                    <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="18" cy="18" r="2" /><path d="M8 11l8-4M8 13l8 4" /></svg>
                    Accès
                  </span>
                  <span>
                    <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></svg>
                    Moi
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
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
            <div className="lp2-ecard" role="img" aria-label="Exemple fictif de carte d’urgence avec un QR code">
              <header>
                <strong>Carte d’urgence</strong>
                <span className="lp2-chip lp2-dec">Exemple fictif</span>
              </header>
              <div className="lp2-band">
                <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-9.5-9C.8 7.6 3 4 6.5 4c2 0 3.4 1.1 4 2 .6-.9 2-2 4-2C18 4 20.2 7.6 18.5 11 16 15.6 12 20 12 20z" /></svg>
                {" "}
                En cas d’urgence
              </div>
              <dl>
                <dt>Nom</dt>
                <dd>Prénom Nom</dd>
                <dt>Allergie</dt>
                <dd>Pénicilline</dd>
                <dt>Traitement</dt>
                <dd>Salbutamol</dd>
                <dt>Contact</dt>
                <dd>07 00 00 00 00</dd>
              </dl>
              <div className="lp2-foot">
                <p>Informations déclarées par le patient. Scannez pour ouvrir la fiche.</p>
                <FakeQr seed={11} />
              </div>
            </div>
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
