import { fieldValue } from "../../lib/legal/config";

/** Adresse de contact renseignée dans lib/legal/config.ts (ou NEXT_PUBLIC_CONTACT_EMAIL). */
export function ContactLine() {
  const email = fieldValue("publisher.email");
  if (!email) return <>Les coordonnées de contact ne sont pas encore indiquées.</>;
  return <a href={`mailto:${email}`}>{email}</a>;
}
