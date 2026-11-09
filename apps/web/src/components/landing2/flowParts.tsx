import { FakeQr } from "./FakeQr";
import type { ReactNode } from "react";

const PENCIL = <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1-4L16 5l3 3L8 19z" /></svg>;
const QR_ICON = <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h2v2h-2zM18 14h2M14 18h2M18 18h2v2" /></svg>;
const DOC_ICON = <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></svg>;
const STETH_ICON = <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4v6a4 4 0 0 0 8 0V4" /><circle cx="18" cy="16" r="3" /><path d="M14 10v2a4 4 0 0 0 1.2 2.9" /></svg>;

/** Parcours en trois étapes : un infirmier prépare la pré-consultation dans l'espace patient (facultatif), le médecin scanne le QR depuis son espace professionnel, le patient retrouve les préconisations. */
export const FLOW_STEPS: { orb: string; icon: ReactNode; title: string; text: string }[] = [
  { orb: "lp2-orb", icon: PENCIL, title: "L’infirmier prépare", text: "Il saisit le motif, les symptômes et les constantes depuis votre espace patient. Sans infirmier, le médecin consulte directement : cette étape est facultative." },
  { orb: "lp2-orb lp2-g", icon: QR_ICON, title: "Le médecin scanne votre QR", text: "Depuis son espace professionnel. Le QR est temporaire et ne sert qu’une fois." },
  { orb: "lp2-orb", icon: DOC_ICON, title: "Vous retrouvez ses préconisations", text: "Le médecin lit, consulte, puis établit ses préconisations. Elles rejoignent votre carnet une fois la consultation validée." },
];

export const FLOW_SCREENS: { node: ReactNode }[] = [
  { node: (
    <>
      <div className="lp2-ap-bar">
        <span>{PENCIL}Pré-consultation</span>
        <i className="lp2-ap-av">EC</i>
      </div>
      <div className="lp2-ap-body">
        <p className="lp2-ap-title">Préparer la consultation</p>
        <div className="lp2-ap-card">
          <span className="lp2-ap-k">Motif</span>
          <div className="lp2-ap-input">Toux depuis trois jours</div>
        </div>
        <div className="lp2-ap-card">
          <span className="lp2-ap-k">Symptômes</span>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <span className="lp2-chip lp2-ok">Toux</span>
            <span className="lp2-chip lp2-ok">Fatigue</span>
            <span className="lp2-chip lp2-me">Maux de gorge</span>
          </div>
        </div>
        <div className="lp2-ap-card">
          <div className="lp2-ap-row">
            <small>Saisie par</small>
            <span className="lp2-chip lp2-dec">Un infirmier</span>
          </div>
        </div>
        <div className="lp2-ap-btn">Enregistrer</div>
      </div>
    </>
  ) },
  { node: (
    <>
      <div className="lp2-ap-bar">
        <span>{QR_ICON}Accès</span>
        <i className="lp2-ap-av">EC</i>
      </div>
      <div className="lp2-ap-body">
        <p className="lp2-ap-title">Mon QR</p>
        <div className="lp2-ap-card" style={{ justifyItems: "center", textAlign: "center" }}>
          <FakeQr seed={3} style={{ width: "112px" }} />
          <span className="lp2-chip lp2-ok">Valable 5 minutes</span>
          <small>Le médecin le scanne depuis son espace professionnel.</small>
        </div>
        <div className="lp2-ap-card">
          <div className="lp2-ap-row">
            <small>Durée de l’accès</small>
            <b>2 heures</b>
          </div>
          <div className="lp2-ap-meter">
            <i />
          </div>
        </div>
        <div className="lp2-ap-card">
          <div className="lp2-ap-row">
            <small>Un médecin à la fois</small>
            <span className="lp2-chip lp2-dec">Fin possible</span>
          </div>
          <small>Vous pouvez mettre fin à l’accès depuis votre historique.</small>
        </div>
      </div>
    </>
  ) },
  { node: (
    <>
      <div className="lp2-ap-bar">
        <span>{STETH_ICON}Consultation</span>
        <i className="lp2-ap-av">EC</i>
      </div>
      <div className="lp2-ap-body">
        <div className="lp2-ap-row">
          <p className="lp2-ap-title">Cabinet exemple</p>
          <span className="lp2-chip lp2-ok">Validée</span>
        </div>
        <div className="lp2-ap-card">
          <span className="lp2-ap-k">Préconisations du médecin</span>
          <ul className="lp2-ap-list">
            <li>Repos et hydratation</li>
            <li>Salbutamol, au besoin</li>
            <li>Contrôle dans 7 jours</li>
          </ul>
        </div>
        <div className="lp2-ap-card">
          <div className="lp2-ap-row">
            <span style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <i className="lp2-dot lp2-h">{DOC_ICON}</i>
              <b>Ordonnance</b>
            </span>
            <small>PDF</small>
          </div>
        </div>
        <div className="lp2-ap-card">
          <div className="lp2-ap-row">
            <span style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <i className="lp2-dot lp2-g">
                <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>
              </i>
              <span>
                <b>Ajoutée à votre carnet</b>
                <br />
                <small>Consultation médicale validée</small>
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
