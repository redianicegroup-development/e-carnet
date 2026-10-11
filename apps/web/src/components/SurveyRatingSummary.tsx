"use client";

import { useEffect, useState } from "react";

type Summary = { average_rating: number | null; responses_total: number };
const retryDelays = [0, 8_000, 18_000];

export function SurveyRatingSummary() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (const delay of retryDelays) {
        if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay));
        if (cancelled) return;
        try {
          const response = await fetch("/api/v1/identity/feedback2/summary/", { cache: "no-store" });
          const payload = await response.json().catch(() => null);
          if (response.ok && payload?.success && payload.data) {
            if (!cancelled) setSummary(payload.data as Summary);
            return;
          }
        } catch { /* le site reste utilisable si l’API Render se réveille */ }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const count = summary?.responses_total ?? 0;
  const average = summary?.average_rating ?? null;
  const filledStars = average === null ? 0 : Math.round(average);
  const averageLabel = average === null ? "—" : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(average);

  return <section className="lp-section lp-rating-section" aria-labelledby="survey-rating-title">
    <div className="lp-heading"><span className="eyebrow">Votre expérience</span><h2 id="survey-rating-title">Aidez-nous à rendre E‑Carnet plus simple et plus utile</h2><p className="lead">Une courte enquête apparaît après cinq pages publiques; les réponses servent à améliorer l’ergonomie et le carnet.</p></div>
    <div className="lp-rating-card card">
      <div className="survey-rating-stars" role="img" aria-label={count ? `Note moyenne ${averageLabel} sur 5, calculée sur ${count} réponse${count > 1 ? "s" : ""}` : "Aucune note reçue pour le moment"}>
        {[1, 2, 3, 4, 5].map((star) => <span key={star} className={star <= filledStars ? "is-filled" : ""} aria-hidden="true">★</span>)}
      </div>
      <strong className="lp-rating-score">{averageLabel}<span>/5</span></strong>
      <p className="muted">{count ? `${count} réponse${count > 1 ? "s" : ""} · note moyenne des avis reçus` : "Les premières réponses feront apparaître la note moyenne ici."}</p>
    </div>
  </section>;
}
