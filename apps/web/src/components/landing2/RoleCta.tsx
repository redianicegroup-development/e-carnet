import Link from "next/link";
import { PROFILES } from "../../lib/landing-content";

/** Bouton d'une carte de rôle : lien, suivi d'inscription et objet du contact viennent de PROFILES (une seule source). */
export function RoleCta({ index }: { index: number }) {
  const { cta } = PROFILES[index];
  const className = index === 0 ? "lp2-btn lp2-btn-primary" : "lp2-btn lp2-btn-ghost";
  return cta.subject
    ? <a className={className} href={cta.href} data-contact-subject={cta.subject}>{cta.text}</a>
    : <Link className={className} href={cta.href} data-track={cta.track}>{cta.text}</Link>;
}
