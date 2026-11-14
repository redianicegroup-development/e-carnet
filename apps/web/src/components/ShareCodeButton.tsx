"use client";

import { useEffect, useRef, useState } from "react";
import { SHARE_FEEDBACK, shareContent, type ShareContent, type ShareOutcome } from "../lib/share";
import "./share-button.css";

/* Icône « Partager » à côté d'un code généré. Un appui ouvre la feuille de partage du téléphone avec un message prêt à l'emploi
   (lien de l'application, e-mail et code) ; sans feuille de partage, le message est copié. Le message est construit à l'appui : le code
   n'est pas écrit dans le DOM en dehors de l'endroit où il est déjà affiché. */
export function ShareCodeButton({ title, buildText, label = "Partager", className }: { title: string; buildText: () => string; label?: string; className?: string }) {
  const [feedback, setFeedback] = useState("");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function share() {
    const content: ShareContent = { title, text: buildText() };
    const outcome: ShareOutcome = await shareContent(content);
    window.clearTimeout(timer.current);
    setFeedback(SHARE_FEEDBACK[outcome]);
    if (SHARE_FEEDBACK[outcome]) timer.current = window.setTimeout(() => setFeedback(""), 3500);
  }

  return <span className={`share-code${className ? ` ${className}` : ""}`}>
    <button type="button" className="share-code__button" onClick={() => void share()} aria-label={`${label} : ${title}`} title={label}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="share-code__icon"><circle cx="18" cy="5" r="2.6" /><circle cx="6" cy="12" r="2.6" /><circle cx="18" cy="19" r="2.6" /><path d="M8.3 10.8l7.4-4.3M8.3 13.2l7.4 4.3" /></svg>
    </button>
    <span className="share-code__status" role="status" aria-live="polite">{feedback}</span>
  </span>;
}
