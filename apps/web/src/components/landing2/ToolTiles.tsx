import { FakeQr } from "./FakeQr";

/** Généré depuis la maquette (section « Le carnet ») : huit écrans fictifs. */
export function ToolTiles() {
  return (
    <>
      <div className="lp2-head lp2-rv">
        <span className="lp2-eyebrow">Le carnet</span>
        <h2 id="tools-title">Un carnet simple, rangé écran par écran</h2>
        <p className="lp2-lead">Huit espaces pour garder l’essentiel à portée de main. Les exemples ci-dessous sont fictifs.</p>
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
          <h3>Mon carnet</h3>
          <p>Antécédents, allergies et traitements, chacun marqué par son origine.</p>
        </article>
        <article className="lp2-tile lp2-rv">
          <div className="lp2-view" aria-hidden="true">
            <span className="lp2-ap-k">Ma consultation</span>
            <div className="lp2-ap-input">Toux depuis trois jours</div>
            <div className="lp2-ap-input" style={{ minHeight: "48px" }}>Pire la nuit, pas de fièvre.</div>
            <div className="lp2-ap-btn">Enregistrer</div>
          </div>
          <h3>Pré-consultation</h3>
          <p>Notez le motif et vos observations avant le rendez-vous.</p>
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
          <h3>Documents</h3>
          <p>Ordonnances et comptes rendus rangés avec vos consultations.</p>
        </article>
        <article className="lp2-tile lp2-rv">
          <div className="lp2-view" aria-hidden="true">
            <div className="lp2-ap-row">
              <span className="lp2-ap-k">Mesures</span>
              <span className="lp2-chip lp2-me">Mesuré</span>
            </div>
            <svg className="lp2-chart" viewBox="0 0 200 100" role="presentation"><g stroke="#F3DFB6" strokeWidth="1"><path d="M0 20H200M0 50H200M0 80H200" /></g><path d="M8 70 L48 58 L88 64 L128 40 L168 46 L192 28 V100 H8Z" fill="#3B826C" opacity=".14" /><path d="M8 70 L48 58 L88 64 L128 40 L168 46 L192 28" fill="none" stroke="#3B826C" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><circle cx="192" cy="28" r="5" fill="#FFC857" stroke="#3B826C" strokeWidth="2.5" /></svg>
            <small>Exemple de suivi dans le temps</small>
          </div>
          <h3>Mesures</h3>
          <p>Suivez vos mesures et repérez l’évolution d’un coup d’œil.</p>
        </article>
        <article className="lp2-tile lp2-rv">
          <div className="lp2-view" aria-hidden="true">
            <span className="lp2-ap-k">Vaccinations</span>
            <div className="lp2-ap-card">
              <div className="lp2-ap-row">
                <span style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <i className="lp2-dot lp2-g">
                    <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>
                  </i>
                  <b>Tétanos</b>
                </span>
                <small>2024</small>
              </div>
            </div>
            <div className="lp2-ap-card">
              <div className="lp2-ap-row">
                <span style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <i className="lp2-dot lp2-g">
                    <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>
                  </i>
                  <b>Fièvre jaune</b>
                </span>
                <small>2022</small>
              </div>
            </div>
            <div className="lp2-ap-card">
              <div className="lp2-ap-row">
                <span style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <i className="lp2-dot lp2-h">
                    <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                  </i>
                  <b>Grippe</b>
                </span>
                <small>À prévoir</small>
              </div>
            </div>
          </div>
          <h3>Vaccinations</h3>
          <p>Gardez la liste de vos vaccins et ce qui reste à prévoir.</p>
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
          <h3>Rendez-vous et rappels</h3>
          <p>Un agenda et des rappels pour ne rien laisser passer.</p>
        </article>
        <article className="lp2-tile lp2-rv">
          <div className="lp2-view" aria-hidden="true" style={{ gridTemplateColumns: "1fr 64px", alignItems: "center" }}>
            <div style={{ display: "grid", gap: "6px" }}>
              <span className="lp2-ap-k" style={{ color: "var(--lp2-p-danger)" }}>Carte d’urgence</span>
              <b>Prénom Nom</b>
              <small>Allergie : pénicilline</small>
              <span className="lp2-chip lp2-dec" style={{ justifySelf: "start" }}>Déclaré</span>
            </div>
            <FakeQr seed={7} />
          </div>
          <h3>Carte d’urgence</h3>
          <p>Un QR activé par vous, ou un téléchargement en image PNG.</p>
        </article>
        <article className="lp2-tile lp2-rv">
          <div className="lp2-view" aria-hidden="true">
            <span className="lp2-ap-k">Historique des accès</span>
            <div className="lp2-ap-card">
              <div className="lp2-ap-row">
                <b>Cabinet exemple</b>
                <span className="lp2-chip lp2-ok">Autorisé 2 h</span>
              </div>
            </div>
            <div className="lp2-ap-card">
              <div className="lp2-ap-row">
                <b>Clinique exemple</b>
                <span className="lp2-chip lp2-no">Refusé</span>
              </div>
            </div>
            <div className="lp2-ap-card">
              <div className="lp2-ap-row">
                <b>Cabinet exemple</b>
                <span className="lp2-chip lp2-ok">Terminé</span>
              </div>
            </div>
          </div>
          <h3>Historique des accès</h3>
          <p>Qui a demandé quoi, quand, et la décision que vous avez prise.</p>
        </article>
      </div>
    </>
  );
}
