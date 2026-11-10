"use client";

import { EmergencyCardVisual, type EmergencyCardView } from "../emergency-card/EmergencyCardVisual";

const X = "xxxxxxxxxx";

/** Vraie carte d’urgence de l’application, avec toutes les valeurs masquées (« xxxxxxxxxx ») : seule la mise en page est montrée.
 *  Composant client : la carte embarque qrcode.react, qui ne peut pas être importé dans un composant serveur. */
const MASKED_CARD: EmergencyCardView = { first_name: X, last_name: X, city: X, blood_group: X, height_cm: X, weight_kg: X, allergies: [{ label: X }], treatments: [], contact_name: X, contact_phone: X };

export function MaskedEmergencyCard() {
  return (
    <div className="lp2-ucard" role="img" aria-label="Exemple de carte d’urgence Mon E‑Carnet : les informations personnelles sont masquées.">
      <EmergencyCardVisual card={MASKED_CARD} showQr={false} photo={{ url: "/landing/carte-titulaire.webp", initials: "xx" }} />
    </div>
  );
}
