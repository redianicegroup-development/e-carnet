import { fieldValue } from "../../lib/legal/config";

/** Adresse de contact renseignée dans lib/legal/config.ts (ou NEXT_PUBLIC_CONTACT_EMAIL). Sans adresse : phrase d'attente honnête. */
export function ContactLine() {
  const email = fieldValue("publisher.email");
  if (!email) return <>Les coordonnées de contact seront indiquées avant l’ouverture du pilote.</>;
  return <a href={`mailto:${email}`}>{email}</a>;
}
