import { HERO } from "../../lib/landing-content";
import { BrandMark } from "../ui/BrandMark";
import { Icon } from "../ui/Icon";

/* Aperçu du tableau de bord d'un établissement, au bas du héro (même esprit que la maquette d'application d'un héro SaaS : le produit dépasse du bas de l'écran).
   C'est une illustration dessinée en HTML et en CSS, pas une capture : nette à toutes les tailles, aux couleurs du thème actif, et sans nom ni photo
   de personne réelle. Les chiffres sont des données d'exemple. Tout est décoratif : le lecteur d'écran lit la seule description (HERO.previewLabel).
   Les dimensions sont en « em » (CSS .hp) : l'aperçu grandit et rétrécit avec la largeur de l'écran. */

const BARS = [34, 58, 44, 82, 62, 24, 12]; // hauteur des barres, en % : les rendez-vous de la semaine
const DAYS = ["L", "M", "M", "J", "V", "S", "D"];

const CARDS = [
  { title: "Médecins actifs", value: "4", icon: "users", note: "+1 ces 30 derniers jours", lead: true },
  { title: "Demandes à traiter", value: "2", icon: "document", note: "À examiner" },
  { title: "Rendez-vous à venir", value: "6", icon: "clock", note: "3 cette semaine" },
  { title: "Codes médecin actifs", value: "1", icon: "qr", note: "Non utilisés · valables 48 h" },
] as const;

export function HeroPreview() {
  return (
    <div className="hp" data-hero-preview role="img" aria-label={HERO.previewLabel}>
      <div className="hp__frame" aria-hidden="true">
        <div className="hp__win">
          <aside className="hp__side">
            <span className="hp__side-logo"><BrandMark variant="duo" /></span>
            <span className="hp__nav hp__nav--toggle"><Icon name="sidebar" size={20} /></span>
            <span className="hp__nav is-on"><Icon name="home" size={20} /></span>
            <span className="hp__nav"><Icon name="folder" size={20} /></span>
            <span className="hp__nav"><Icon name="users" size={20} /></span>
            <span className="hp__nav"><Icon name="document" size={20} /></span>
          </aside>

          <div className="hp__main">
            <div className="hp__who">
              <span className="hp__who-tile"><BrandMark /></span>
              <span className="hp__who-text"><small>Établissement exemple · Abidjan</small><strong>Équipe soignante</strong></span>
            </div>

            <div className="hp__head">
              <div className="hp__title">
                <b>Tableau de bord</b>
                <p>Suivez votre équipe, les demandes et l’activité de l’établissement. Vue administrative : aucun dossier patient.</p>
              </div>
              <div className="hp__actions">
                <span className="hp__btn hp__btn--primary"><Icon name="plus" size={18} />Ajouter un médecin</span>
                <span className="hp__btn">Dossiers patients</span>
              </div>
            </div>

            <div className="hp__cards">
              {CARDS.map((card) => (
                <div className={`hp__card${"lead" in card ? " hp__card--lead" : ""}`} key={card.title}>
                  <div className="hp__card-top"><span>{card.title}</span><i className="hp__go"><Icon name="arrowUp" size={16} /></i></div>
                  <b className="hp__num">{card.value}</b>
                  <p className="hp__note"><i><Icon name={card.icon} size={16} /></i>{card.note}</p>
                </div>
              ))}
            </div>

            <div className="hp__row">
              <div className="hp__panel hp__panel--chart">
                <span className="hp__panel-title">Rendez-vous de la semaine</span>
                <div className="hp__bars">
                  {BARS.map((height, index) => (
                    <span className="hp__bar" key={index}><i style={{ height: `${height}%` }} /><em>{DAYS[index]}</em></span>
                  ))}
                </div>
              </div>
              <div className="hp__panel">
                <span className="hp__panel-title">À faire</span>
                <b className="hp__todo">Tout est à jour</b>
                <p className="hp__note">Aucune demande en attente et aucun rendez-vous à venir.</p>
                <span className="hp__btn hp__btn--primary"><Icon name="qr" size={18} />Créer un code médecin</span>
              </div>
              <div className="hp__panel">
                <span className="hp__panel-title">Demandes récentes</span>
                <ul className="hp__list">
                  <li><i>DK</i><span><b>Dr Koné</b><small>Demande du 24 oct.</small></span><em>Actif</em></li>
                  <li><i>AT</i><span><b>Dr Traoré</b><small>Demande du 21 oct.</small></span><em className="is-off">Terminé</em></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
