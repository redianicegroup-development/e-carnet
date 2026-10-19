import { QRCodeSVG } from "qrcode.react";
import { Icon } from "../ui/Icon";
import { PROJECT_LOGO_WEBP } from "../../lib/brand";
import "./emergency-card.css";

export type EmergencyCardItem = { label: string; details?: string };
/** Ce que la carte affiche — et donc ce que voit toute personne qui scanne le QR. */
export type EmergencyCardView = {
  first_name: string;
  last_name: string;
  city: string;
  blood_group: string;
  height_cm: string;
  weight_kg: string;
  allergies: EmergencyCardItem[];
  treatments: EmergencyCardItem[];
  contact_name: string;
  contact_phone: string;
};

/** Photo de profil ou avatar du titulaire : affichée à la place du QR sur la carte téléchargée. */
export type EmergencyCardPhoto = { url?: string; initials: string };

export const EMERGENCY_CARD_FOOTNOTE = "Informations déclarées par le titulaire, non vérifiées par Mon E‑Carnet. Elles ne remplacent ni un avis médical ni les services de secours.";

export function emergencyCardFullName(card: Pick<EmergencyCardView, "first_name" | "last_name">) {
  return [card.first_name, card.last_name].filter(Boolean).join(" ").trim();
}

function Chips({ items, tone }: { items: EmergencyCardItem[]; tone: "allergy" | "treatment" }) {
  return <ul className={`ecard__chips ecard__chips--${tone}`}>{items.map((item, index) => <li key={`${item.label}-${index}`}>{item.label}</li>)}</ul>;
}

/**
 * Carte d’urgence : identité, groupe sanguin, ville, allergies et contact à gauche, QR (scan public) ou photo du titulaire (carte téléchargée) à côté.
 * Elle se met en colonne toute seule quand son conteneur est étroit (container query), sans dépendre de la taille de l’écran.
 * Le même visuel est dessiné en PNG par emergency-card-image.ts.
 */
export function EmergencyCardVisual({ card, qrUrl = "", showQr = true, photo }: { card: EmergencyCardView; qrUrl?: string; showQr?: boolean; photo?: EmergencyCardPhoto }) {
  const name = emergencyCardFullName(card);
  const hasContact = Boolean(card.contact_name || card.contact_phone);
  return (
    <div className="ecard-wrap">
      <article className={`ecard${showQr || photo ? "" : " ecard--solo"}`} aria-label="Carte d’urgence">
        <header className="ecard__band">
          <span className="ecard__brand"><span className="ecard__mark" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo WebP versionné sur Cloudinary */}
            <img src={PROJECT_LOGO_WEBP} alt="" draggable={false} referrerPolicy="no-referrer" />
          </span>Mon E‑Carnet</span>
          <span className="ecard__tag">Carte d’urgence</span>
        </header>
        <div className="ecard__body">
          <div className="ecard__info">
            <h3 className={`ecard__name${name ? "" : " is-empty"}`}>{name || "Identité non renseignée"}</h3>
            <dl className="ecard__fields">
              <div className={`ecard__field ecard__field--blood${card.blood_group ? "" : " is-empty"}`}><dt>Groupe sanguin</dt><dd>{card.blood_group || "Non renseigné"}</dd></div>
              <div className={`ecard__field${card.city ? "" : " is-empty"}`}><dt>Ville</dt><dd>{card.city || "Non renseignée"}</dd></div>
              <div className={`ecard__field${card.height_cm ? "" : " is-empty"}`}><dt>Taille déclarée</dt><dd>{card.height_cm || "Non renseignée"}</dd></div>
              <div className={`ecard__field${card.weight_kg ? "" : " is-empty"}`}><dt>Poids déclaré</dt><dd>{card.weight_kg || "Non renseigné"}</dd></div>
              <div className={`ecard__field ecard__field--wide${card.allergies.length ? "" : " is-empty"}`}><dt>Allergies</dt><dd>{card.allergies.length ? <Chips items={card.allergies} tone="allergy" /> : "Aucune allergie déclarée"}</dd></div>
              {card.treatments.length > 0 && <div className="ecard__field ecard__field--wide"><dt>Traitements</dt><dd><Chips items={card.treatments} tone="treatment" /></dd></div>}
              <div className={`ecard__field ecard__field--wide ecard__field--contact${hasContact ? "" : " is-empty"}`}>
                <dt>Contact d’urgence</dt>
                <dd>{hasContact ? <>{card.contact_name && <strong>{card.contact_name}</strong>}{card.contact_phone && <span className="ecard__phone">{card.contact_phone}</span>}</> : "Non renseigné"}</dd>
              </div>
            </dl>
          </div>
          {showQr && (
            <div className="ecard__qr">
              {qrUrl
                ? <>
                  <div className="ecard__qr-box"><QRCodeSVG value={qrUrl} size={200} level="M" marginSize={3} title="QR de la carte d’urgence" /></div>
                  <p>Scannez pour afficher la carte</p>
                </>
                : <div className="ecard__qr-off">
                  <Icon name="lock" size={30} />
                  <strong>QR désactivé</strong>
                  <span>Activez-le pour partager cette carte.</span>
                </div>}
            </div>
          )}
          {!showQr && photo && (
            <div className="ecard__photo">
              <div className="ecard__photo-frame">
                {/* eslint-disable-next-line @next/next/no-img-element -- avatar du compte, éventuellement externe */}
                {photo.url ? <img src={photo.url} alt="" referrerPolicy="no-referrer" /> : <span aria-hidden="true">{photo.initials}</span>}
              </div>
              <p>Titulaire de la carte</p>
            </div>
          )}
        </div>
        <footer className="ecard__foot">{EMERGENCY_CARD_FOOTNOTE}</footer>
      </article>
    </div>
  );
}
