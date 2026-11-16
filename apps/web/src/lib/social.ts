import { fieldValue } from "./legal/config";

/* Contacts affichés dans le menu et le pied de page publics : e-mail, WhatsApp, Facebook.
   À renseigner ici, ou par variables d'environnement (voir .env.example). Les valeurs sont publiques : jamais de secret. */

/** Numéro WhatsApp au format international, sans « + » ni espaces (ex. 2250566191444). Le même que celui de la page Mon E-Carnet de redianice.com. */
const WHATSAPP_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "2250566191444").replace(/\D/g, "");
/** Adresse de la page Facebook (https://www.facebook.com/…). Vide tant qu'elle n'est pas donnée : l'icône reste affichée mais n'ouvre rien. */
const FACEBOOK_URL = (process.env.NEXT_PUBLIC_FACEBOOK_URL ?? "").trim();

export type SocialLink = { id: "email" | "whatsapp" | "facebook"; label: string; href: string | null; external: boolean };

/** E-mail : l'adresse de contact si elle est renseignée, sinon le formulaire de contact de l'accueil (comme « Nous écrire » du pied de page). */
export function socialLinks(): SocialLink[] {
  const email = fieldValue("publisher.email");
  return [
    { id: "email", label: "Nous écrire", href: email ? `mailto:${email}` : "/#contact", external: false },
    { id: "whatsapp", label: "WhatsApp", href: WHATSAPP_NUMBER ? `https://wa.me/${WHATSAPP_NUMBER}` : null, external: true },
    { id: "facebook", label: "Facebook", href: /^https:\/\//i.test(FACEBOOK_URL) ? FACEBOOK_URL : null, external: true },
  ];
}
