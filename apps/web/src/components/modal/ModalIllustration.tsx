"use client";

import type { CSSProperties } from "react";
import "./modal.css";

/* Une « humeur » = une illustration du dossier .modal (copiée dans public/illustrations/modal).
   Pour changer l'illustration d'une situation, il suffit de modifier cette table. */
export type ModalMood = "welcome" | "morning" | "evening" | "success" | "question" | "decision" | "farewell" | "listening" | "oops";

const SOURCES: Record<ModalMood, string> = {
  welcome: "/illustrations/modal/welcome.svg",     // coaching — on vous accueille et on vous explique
  morning: "/illustrations/modal/morning.svg",     // exercising — énergie du matin
  evening: "/illustrations/modal/evening.svg",     // meditating — calme du soir
  success: "/illustrations/modal/success.svg",     // answer — c'est bon, merci
  question: "/illustrations/modal/question.svg",   // question — hésitation avant une action sensible
  decision: "/illustrations/modal/decision.svg",   // decision — carrefour, un choix à faire
  farewell: "/illustrations/modal/farewell.svg",   // discharging-patient — fin d'un rattachement, sortie
  listening: "/illustrations/modal/listening.svg", // face-headset — on vous écoute (feedback)
  oops: "/illustrations/modal/oops.svg",           // face-bandage — petit souci, on réessaie
};

type Props = { mood: ModalMood; size?: "sm" | "md" | "lg" };

/* Décorative : le sens est porté par le titre de la modal (aria-hidden). Le dessin est un masque coloré par
   `currentColor` : il suit automatiquement le thème (palette claire/sombre) sans modifier les SVG. */
export function ModalIllustration({ mood, size = "md" }: Props) {
  return <span className={`modal-illustration modal-illustration--${size}`} data-mood={mood} aria-hidden="true" style={{ "--modal-illustration": `url(${SOURCES[mood]})` } as CSSProperties} />;
}
