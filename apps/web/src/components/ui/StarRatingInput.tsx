"use client";

import { useId, useState } from "react";

/* Note en étoiles « Noter l'application » : cinq étoiles, un aperçu qui suit le doigt ou la souris, un libellé qui dit ce que la note veut dire.
   Groupe de boutons radio (flèches, Début, Fin, Échap pour effacer) : utilisable au clavier et au lecteur d'écran, sans dépendre du survol. */
export const RATING_LABELS = ["Pas très bien", "Peut mieux faire", "Correct", "Bien", "Excellent"] as const;

export function ratingLabel(value: number): string {
  return value >= 1 && value <= 5 ? RATING_LABELS[value - 1] : "";
}

export function StarRatingInput({ value, onChange, disabled = false, label = "Votre note" }: { value: number; onChange: (value: number) => void; disabled?: boolean; label?: string }) {
  const [hover, setHover] = useState(0);
  const labelId = useId();
  const shown = hover || value;

  function onKeyDown(event: React.KeyboardEvent) {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };
    if (event.key in keys) { event.preventDefault(); onChange(Math.min(5, Math.max(1, (value || 0) + keys[event.key]))); }
    else if (event.key === "Home") { event.preventDefault(); onChange(1); }
    else if (event.key === "End") { event.preventDefault(); onChange(5); }
    else if (event.key === "Escape" && value) { event.stopPropagation(); onChange(0); }
  }

  return (
    <div className="star-input">
      <span id={labelId} className="star-input__label">{label} <small className="muted">(facultatif)</small></span>
      <div className="star-input__row" role="radiogroup" aria-labelledby={labelId} onKeyDown={onKeyDown} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} étoile${star > 1 ? "s" : ""} sur 5 : ${RATING_LABELS[star - 1]}`}
            tabIndex={value === star || (!value && star === 1) ? 0 : -1}
            disabled={disabled}
            className={star <= shown ? "star-input__star is-filled" : "star-input__star"}
            onMouseEnter={() => setHover(star)}
            onFocus={() => setHover(0)}
            onClick={() => onChange(value === star ? 0 : star)}
          >
            <span aria-hidden="true">★</span>
          </button>
        ))}
      </div>
      <span className="star-input__caption" aria-live="polite">{shown ? `${shown}/5 · ${ratingLabel(shown)}` : "Touchez une étoile pour noter"}</span>
    </div>
  );
}
