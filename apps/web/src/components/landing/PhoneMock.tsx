import { Icon, type IconName } from "../ui/Icon";

const TABS: [IconName, string, boolean][] = [["home", "Accueil", true], ["folder", "Carnet", false], ["stethoscope", "Consult.", false], ["share", "Accès", false], ["user", "Moi", false]];

/** Maquette de l'accueil patient réel (même onglets). Illustration : aucune donnée, tout est fictif. */
export function PhoneMock({ decorative = false }: { decorative?: boolean }) {
  return (
    <div className="lp-phone" {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": "Aperçu de l’espace patient" })}>
      <div className="lp-phone__screen" aria-hidden="true">
        <div className="mk-bar"><span className="mk-brand"><i>＋</i>E-carnet</span><span className="mk-avatar">EC</span></div>
        <div className="mk-body">
          <p className="mk-hello"><small>Mon espace</small><strong>Mon carnet</strong></p>
          <div className="mk-alert"><strong>Demande d’accès</strong><span>À examiner</span><b>Voir</b></div>
          <div className="mk-cta"><small>À préparer</small><strong>Ma consultation</strong></div>
          <div className="mk-stats"><span><b>+</b>Déclarations</span><span><b>›</b>Consultations</span><span><b>✓</b>Accès</span></div>
        </div>
        <div className="mk-tabs">{TABS.map(([icon, label, active]) => <span key={label} className={active ? "on" : ""}><Icon name={icon} size={16} />{label}</span>)}</div>
      </div>
    </div>
  );
}
