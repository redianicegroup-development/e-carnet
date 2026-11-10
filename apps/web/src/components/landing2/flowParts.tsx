import type { ReactNode } from "react";

const PENCIL = <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1-4L16 5l3 3L8 19z" /></svg>;
const QR_ICON = <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h2v2h-2zM18 14h2M14 18h2M18 18h2v2" /></svg>;
const DOC_ICON = <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></svg>;

/** Parcours en trois étapes : un infirmier prépare la pré-consultation dans l'espace patient (facultatif), le médecin scanne le QR depuis son espace professionnel, le patient retrouve les préconisations.
 *  Chaque étape montre une vraie capture détourée (main et téléphone). */
export const FLOW_STEPS: { orb: string; icon: ReactNode; title: string; text: string; image: { src: string; alt: string } }[] = [
  { orb: "lp2-orb", icon: PENCIL, title: "L’infirmier prépare", text: "Il saisit le motif, les symptômes et les constantes depuis votre espace patient. Sans infirmier, le médecin consulte directement : cette étape est facultative.", image: { src: "/landing/hand-motif.webp", alt: "Une main tient un téléphone ouvert sur la pré-consultation : le motif « Maux de ventre » et des symptômes cochés." } },
  { orb: "lp2-orb lp2-g", icon: QR_ICON, title: "Le médecin scanne votre QR", text: "Depuis son espace professionnel. Le QR est temporaire et ne sert qu’une fois.", image: { src: "/landing/hand-qr.webp", alt: "Une main tient un téléphone ouvert sur le QR temporaire du patient, avec son compte à rebours." } },
  { orb: "lp2-orb", icon: DOC_ICON, title: "Vous retrouvez ses préconisations", text: "Le médecin lit, consulte, puis établit ses préconisations. Elles rejoignent votre carnet une fois la consultation validée.", image: { src: "/landing/hand-accueil.webp", alt: "Une main tient un téléphone ouvert sur l’accueil du carnet du patient." } },
];
