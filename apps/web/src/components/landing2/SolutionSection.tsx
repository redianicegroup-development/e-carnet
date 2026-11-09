"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/** Captures de l'application (détourées : main et téléphone seuls). Dimensions identiques, ancrées en bas à gauche pour que le fondu d'une image à l'autre reste stable. */
const SHOTS = [
  { src: "/landing/hand-carnet.webp", label: "Votre carnet est rempli une fois", alt: "Une main tient un téléphone ouvert sur l’accueil du carnet : carte d’informations, déclarations, documents, vaccins, rappels et plans de suivi." },
  { src: "/landing/hand-preconsultation.webp", label: "Un infirmier prépare la pré-consultation depuis votre espace, ou le médecin consulte directement", alt: "Une main tient un téléphone ouvert sur la pré-consultation de l’espace patient : le motif et les symptômes à cocher." },
  { src: "/landing/hand-qr.webp", label: "Le médecin scanne votre QR, consulte et fait ses préconisations", alt: "Une main tient un téléphone ouvert sur l’accueil du patient, avec le bouton « Partager en QR »." },
] as const;

const SHOT_MS = 5500;

/** Solution : le carnet comme réponse. Trois captures réelles de l'application, une par moment du parcours.
 *  Défilement automatique tant que la personne n'a pas choisi elle-même (et jamais si l'animation est réduite). */
export function SolutionSection() {
  const [current, setCurrent] = useState(0);
  const [chosen, setChosen] = useState(false);

  useEffect(() => {
    if (chosen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => setCurrent((index) => (index + 1) % SHOTS.length), SHOT_MS);
    return () => window.clearTimeout(timer);
  }, [chosen, current]);

  return (
    <div className="lp2-row lp2-solution">
      <div className="lp2-copy lp2-rv">
        <h2 id="solution-title">Un carnet que vous remettez, un médecin qui peut conseiller.</h2>
        <p className="lp2-lead">Mon E-Carnet réunit votre santé au même endroit. Un infirmier peut préparer la pré-consultation depuis votre espace patient. Sinon, le médecin consulte directement : il scanne votre QR depuis son espace professionnel, lit l’essentiel, puis établit ses préconisations.</p>
        <ul className="lp2-picks">
          {SHOTS.map((shot, index) => (
            <li key={shot.src}>
              <button type="button" className="lp2-pick" aria-pressed={current === index} onClick={() => { setCurrent(index); setChosen(true); }}>
                <svg className="lp2-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>
                <span>{shot.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <figure className="lp2-hand lp2-rv">
        <div className="lp2-hand-stack">
          {SHOTS.map((shot, index) => (
            <Image
              key={shot.src}
              className={`lp2-hand-img${current === index ? " lp2-on" : ""}`}
              src={shot.src}
              alt={shot.alt}
              width={900}
              height={1272}
              sizes="(max-width: 900px) 80vw, 460px"
              aria-hidden={current === index ? undefined : true}
            />
          ))}
        </div>
        <figcaption className="lp2-hand-note">Captures de l’application, avec des données fictives.</figcaption>
      </figure>
    </div>
  );
}
