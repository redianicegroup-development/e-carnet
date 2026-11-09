/** Généré depuis la maquette (section « Le carnet ») : quatre écrans fictifs. */
export function ToolTiles() {
  return (
    <>
      <div className="lp2-head lp2-rv">
        <h2 id="tools-title">Votre santé, enfin réunie au même endroit.</h2>
        <p className="lp2-lead">L’essentiel, d’un coup d’œil. Les exemples ci-dessous sont fictifs.</p>
      </div>
      <div className="lp2-tiles">
        <article className="lp2-tile lp2-rv">
          <div className="lp2-view" aria-hidden="true">
            <span className="lp2-ap-k">Mon carnet</span>
            <div className="lp2-ap-card">
              <div className="lp2-ap-row">
                <b>Allergies</b>
                <span className="lp2-chip lp2-dec">Déclaré</span>
              </div>
              <small>Pénicilline</small>
            </div>
            <div className="lp2-ap-card">
              <div className="lp2-ap-row">
                <b>Antécédents</b>
                <span className="lp2-chip lp2-dec">Déclaré</span>
              </div>
              <small>Asthme léger</small>
            </div>
            <div className="lp2-ap-card">
              <div className="lp2-ap-row">
                <b>Traitements</b>
                <span className="lp2-chip lp2-dec">Déclaré</span>
              </div>
              <small>Salbutamol, au besoin</small>
            </div>
          </div>
          <h3>Ne répétez plus votre histoire</h3>
          <p className="lp2-kick">Mon carnet</p>
          <p>Antécédents, allergies et traitements, chacun marqué par son origine.</p>
        </article>
        <article className="lp2-tile lp2-rv">
          <div className="lp2-view" aria-hidden="true">
            <div className="lp2-ap-row">
              <span className="lp2-ap-k">Préconisations</span>
              <span className="lp2-chip lp2-ok">Validée</span>
            </div>
            <div className="lp2-ap-card">
              <b>Repos et hydratation</b>
            </div>
            <div className="lp2-ap-card">
              <b>Contrôle dans 7 jours</b>
              <small>Cabinet exemple</small>
            </div>
          </div>
          <h3>Repartez avec les conseils du médecin</h3>
          <p className="lp2-kick">Préconisations</p>
          <p>Après la consultation, ses préconisations rejoignent votre carnet.</p>
        </article>
        <article className="lp2-tile lp2-rv">
          <div className="lp2-view" aria-hidden="true">
            <span className="lp2-ap-k">Documents</span>
            <div className="lp2-ap-card">
              <div className="lp2-ap-row">
                <span style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <i className="lp2-dot lp2-h">
                    <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></svg>
                  </i>
                  <b>Ordonnance</b>
                </span>
                <small>PDF</small>
              </div>
            </div>
            <div className="lp2-ap-card">
              <div className="lp2-ap-row">
                <span style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <i className="lp2-dot lp2-g">
                    <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></svg>
                  </i>
                  <b>Résultats</b>
                </span>
                <small>PDF</small>
              </div>
            </div>
            <div className="lp2-ap-card">
              <div className="lp2-ap-row">
                <span style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <i className="lp2-dot lp2-h">
                    <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></svg>
                  </i>
                  <b>Compte rendu</b>
                </span>
                <small>PDF</small>
              </div>
            </div>
          </div>
          <h3>Retrouvez vos ordonnances en un geste</h3>
          <p className="lp2-kick">Documents</p>
          <p>Ordonnances et comptes rendus rangés avec vos consultations.</p>
        </article>
        <article className="lp2-tile lp2-rv">
          <div className="lp2-view" aria-hidden="true">
            <span className="lp2-ap-k">Rendez-vous</span>
            <div className="lp2-ap-card">
              <div className="lp2-ap-row">
                <span style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <i className="lp2-dot lp2-h" style={{ width: "38px", height: "38px", font: "700 13px/1 var(--lp2-f-display)" }}>
                    12
                    <small style={{ font: "600 8px var(--lp2-f-body)" }}>NOV.</small>
                  </i>
                  <span>
                    <b>Consultation</b>
                    <br />
                    <small>Cabinet exemple · 09:30</small>
                  </span>
                </span>
              </div>
            </div>
            <div className="lp2-ap-card">
              <div className="lp2-ap-row">
                <span style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <i className="lp2-dot lp2-g">
                    <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0v5l2 3H4l2-3z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
                  </i>
                  <b>Rappel de traitement</b>
                </span>
                <small>08:00</small>
              </div>
            </div>
          </div>
          <h3>Ne manquez plus un rendez-vous ni un traitement</h3>
          <p className="lp2-kick">Rendez-vous et rappels</p>
          <p>Un agenda et des rappels, au même endroit.</p>
        </article>
      </div>
    </>
  );
}
