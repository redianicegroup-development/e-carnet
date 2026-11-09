import { FakeQr } from "./FakeQr";
import type { ReactNode } from "react";

/** Généré depuis la maquette (parcours en trois étapes). */
export const FLOW_STEPS: { orb: string; icon: ReactNode; title: string; text: string }[] = [
  { orb: "lp2-orb", icon: <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1-4L16 5l3 3L8 19z" /></svg>, title: "Préparez", text: "Notez le motif et vos observations avant le rendez-vous." },
  { orb: "lp2-orb lp2-g", icon: <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h2v2h-2zM18 14h2M14 18h2M18 18h2v2" /></svg>, title: "Autorisez", text: "Présentez votre QR. Le professionnel envoie une demande, vous choisissez le contenu et la durée, ou vous refusez." },
  { orb: "lp2-orb", icon: <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h5l2 2h9v10H4z" /></svg>, title: "Retrouvez", text: "Les consultations validées et l’historique des accès rejoignent votre carnet." },
];

export const FLOW_SCREENS: { node: ReactNode }[] = [
  { node: (
    <>
      <div className="lp2-ap-bar">
        <span>
          <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1-4L16 5l3 3L8 19z" /></svg>
          Ma consultation
        </span>
        <i className="lp2-ap-av">EC</i>
      </div>
      <div className="lp2-ap-body">
        <p className="lp2-ap-title">Préparer mon rendez-vous</p>
        <div className="lp2-ap-card">
          <span className="lp2-ap-k">Motif</span>
          <div className="lp2-ap-input">Toux depuis trois jours</div>
        </div>
        <div className="lp2-ap-card">
          <span className="lp2-ap-k">Mes observations</span>
          <div className="lp2-ap-input" style={{ minHeight: "64px" }}>Pire la nuit. Pas de fièvre. Je prends déjà mon traitement habituel.</div>
        </div>
        <div className="lp2-ap-btn">Enregistrer</div>
      </div>
    </>
  ) },
  { node: (
    <>
      <div className="lp2-ap-bar">
        <span>
          <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="18" cy="18" r="2" /><path d="M8 11l8-4M8 13l8 4" /></svg>
          Accès
        </span>
        <i className="lp2-ap-av">EC</i>
      </div>
      <div className="lp2-ap-body">
        <p className="lp2-ap-title">Demande d’accès</p>
        <div className="lp2-ap-card">
          <div className="lp2-ap-row">
            <b>Cabinet exemple</b>
            <span className="lp2-chip lp2-dec">À examiner</span>
          </div>
          <div className="lp2-ap-row">
            <small>Périmètre</small>
            <b>Informations de consultation</b>
          </div>
          <div className="lp2-ap-row">
            <small>Durée</small>
            <b>2 heures</b>
          </div>
          <div className="lp2-ap-meter">
            <i />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: "8px" }}>
          <div className="lp2-ap-btn lp2-alt">Refuser</div>
          <div className="lp2-ap-btn">Autoriser</div>
        </div>
        <FakeQr seed={3} style={{ width: "84px", margin: "4px auto 0" }} />
      </div>
    </>
  ) },
  { node: (
    <>
      <div className="lp2-ap-bar">
        <span>
          <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h5l2 2h9v10H4z" /></svg>
          Historique
        </span>
        <i className="lp2-ap-av">EC</i>
      </div>
      <div className="lp2-ap-body">
        <p className="lp2-ap-title">Mon historique</p>
        <div className="lp2-ap-card">
          <div className="lp2-ap-row">
            <span style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <i className="lp2-dot lp2-g">
                <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>
              </i>
              <span>
                <b>Consultation validée</b>
                <br />
                <small>Cabinet exemple</small>
              </span>
            </span>
          </div>
        </div>
        <div className="lp2-ap-card">
          <div className="lp2-ap-row">
            <span style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <i className="lp2-dot lp2-h">
                <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              </i>
              <span>
                <b>Accès autorisé, 2 h</b>
                <br />
                <small>Informations de consultation</small>
              </span>
            </span>
          </div>
        </div>
        <div className="lp2-ap-card">
          <div className="lp2-ap-row">
            <span style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <i className="lp2-dot lp2-r">
                <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </i>
              <span>
                <b>Demande refusée</b>
                <br />
                <small>Clinique exemple</small>
              </span>
            </span>
          </div>
        </div>
      </div>
    </>
  ) },
];

export const FLOW_TABS_BAR: ReactNode = (
  <div className="lp2-ap-tabs">
    <span>
      <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11 12 4l8 7" /><path d="M6 10v9h12v-9" /><path d="M10 19v-5h4v5" /></svg>
      Accueil
    </span>
    <span>
      <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h5l2 2h9v10H4z" /></svg>
      Carnet
    </span>
    <span>
      <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4v6a4 4 0 0 0 8 0V4" /><circle cx="18" cy="16" r="3" /><path d="M14 10v2a4 4 0 0 0 1.2 2.9" /></svg>
      Consult.
    </span>
    <span className="lp2-on">
      <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="18" cy="18" r="2" /><path d="M8 11l8-4M8 13l8 4" /></svg>
      Accès
    </span>
    <span>
      <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></svg>
      Moi
    </span>
  </div>
);
