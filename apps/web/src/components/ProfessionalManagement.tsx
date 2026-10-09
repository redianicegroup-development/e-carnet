import Link from "next/link";

export function ProfessionalManagement() {
  return <section className="hero-page"><span className="eyebrow">Accès établissement</span><h1>Rattachement professionnel</h1><div className="card"><p className="muted">La spécialité professionnelle est déclarée par le médecin. L’établissement vérifie ses justificatifs en interne puis décide du rattachement ; E‑Carnet journalise cette décision et ne collecte aucun numéro ni justificatif personnel.</p><Link className="button primary" href="/professionnel/acces">Gérer mon rattachement</Link></div></section>;
}
