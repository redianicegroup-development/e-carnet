import { fieldValue } from "./legal/config";

/* « Demander un devis » (offre sur devis, ex. Institutionnel) : ouvre la messagerie de l'établissement avec un message déjà rédigé, adressé à
   l'équipe Mon E-Carnet (NEXT_PUBLIC_CONTACT_EMAIL, voir .env.example). Sans adresse renseignée, on renvoie vers le formulaire de contact de l'accueil. */
export type QuoteRequest = { establishmentName: string; offerName: string; practitioners?: number };

export function quoteRequestMessage({ establishmentName, offerName, practitioners }: QuoteRequest): { subject: string; body: string } {
  const name = establishmentName.trim() || "notre établissement";
  const lines = [
    "Bonjour l’équipe Mon E-Carnet,",
    "",
    `Nous souhaitons recevoir un devis pour l’offre ${offerName}.`,
    "",
    `Établissement : ${name}`,
    ...(practitioners && practitioners > 0 ? [`Praticiens actifs aujourd’hui : ${practitioners}`] : []),
    "Type de structure (hôpital, groupe, organisme public) : ",
    "Nombre de sites et de praticiens à rattacher : ",
    "",
    "Pouvez-vous nous préciser le déploiement dédié, l’accompagnement, la sécurité, les intégrations et les conditions contractuelles, puis nous proposer un échange cette semaine ?",
    "",
    "Cordialement,",
    "Nom et fonction : ",
    "Téléphone : ",
  ];
  return { subject: `Demande de devis — offre ${offerName} — ${name}`, body: lines.join("\r\n") };
}

/** Lien du bouton : `mailto:` avec objet et message préremplis, ou le formulaire de l'accueil tant qu'aucune adresse de contact n'est renseignée. */
export function quoteRequestHref(request: QuoteRequest): string {
  const email = fieldValue("publisher.email");
  if (!email) return "/#contact";
  const { subject, body } = quoteRequestMessage(request);
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
