"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

const appreciatedOptions = [
  ["organized_carnet", "Carnet clair et bien organisé"],
  ["consultation_preparation", "Préparation des consultations"],
  ["access_control", "Contrôle des accès et confidentialité"],
  ["history_traceability", "Historique et traçabilité"],
  ["design", "Interface et design"],
  ["health_content", "Qualité des informations du carnet"],
] as const;
const painPointOptions = [
  ["navigation", "Navigation ou ergonomie"],
  ["form_fields", "Champs trop nombreux ou manquants"],
  ["features", "Fonctionnalités difficiles à utiliser"],
  ["clarity", "Consignes ou libellés peu clairs"],
  ["performance", "Lenteur ou problèmes techniques"],
  ["none", "Rien pour le moment"],
] as const;

type Props = { open: boolean; onClose: () => void };

export function ProductSurveyModal({ open, onClose }: Props) {
  const [rating, setRating] = useState(0);
  const [appreciated, setAppreciated] = useState<string[]>([]);
  const [painPoints, setPainPoints] = useState<string[]>([]);
  const [suggestion, setSuggestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [sent, setSent] = useState(false);
  const dialog = useRef<HTMLElement>(null);
  const firstStar = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(busy);
  useEffect(() => { busyRef.current = busy; }, [busy]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstStar.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) onClose();
      if (event.key !== "Tab") return;
      const focusable = dialog.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), textarea:not([disabled])");
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialog.current?.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open, onClose]);

  function toggle(values: string[], setValues: (next: string[]) => void, value: string) {
    setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  function togglePainPoint(value: string) {
    if (value === "none") {
      setPainPoints(painPoints.includes("none") ? [] : ["none"]);
      return;
    }
    setPainPoints(painPoints.includes(value) ? painPoints.filter((item) => item !== value) : [...painPoints.filter((item) => item !== "none"), value]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rating) { setNotice("Sélectionnez une note avant d’envoyer le questionnaire."); return; }
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/v1/identity/feedback2/", {
        method: "POST", credentials: "include", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, appreciated, pain_points: painPoints, improvement_suggestion: suggestion }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? payload.detail ?? "Envoi impossible. Réessayez.");
      setSent(true);
      setNotice("Merci ! Votre note et vos réponses aideront l’équipe à améliorer E‑Carnet.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Envoi impossible. Réessayez.");
    } finally { setBusy(false); }
  }

  if (!open) return null;
  return <div className="product-survey-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section ref={dialog} className="product-survey-dialog" role="dialog" aria-modal="true" aria-labelledby="product-survey-title" aria-describedby="product-survey-privacy">
      <header className="product-survey-header"><div><span className="eyebrow">Une minute pour nous aider</span><h2 id="product-survey-title">Votre expérience compte</h2><p className="muted">Après ces premières pages, dites-nous ce qui fonctionne et ce qu’il faudrait améliorer.</p></div><button className="feedback-dialog__close" type="button" aria-label="Fermer le questionnaire" disabled={busy} onClick={onClose}>×</button></header>
      {sent ? <div className="feedback-success"><p className="notice" role="status">{notice}</p><button className="button primary" type="button" onClick={onClose}>Terminer</button></div> : <form className="product-survey-form" onSubmit={submit}>
        <fieldset className="survey-question"><legend>1. Quelle note globale donnez-vous à votre expérience ? <span aria-hidden="true">*</span></legend><p className="muted">1 = très difficile · 5 = excellente</p><div className="survey-stars" role="radiogroup" aria-label="Note globale sur cinq étoiles">{[1, 2, 3, 4, 5].map((value, index) => <button ref={index === 0 ? firstStar : undefined} key={value} type="button" role="radio" aria-checked={rating === value} aria-label={`${value} étoile${value > 1 ? "s" : ""} sur 5`} className="survey-star" onClick={() => setRating(value)}>{value <= rating ? "★" : "☆"}</button>)}</div></fieldset>
        <fieldset className="survey-question"><legend>2. Qu’appréciez-vous le plus ? <small>(plusieurs choix possibles)</small></legend><div className="survey-options">{appreciatedOptions.map(([value, label]) => <label className="survey-choice" key={value}><input type="checkbox" checked={appreciated.includes(value)} onChange={() => toggle(appreciated, setAppreciated, value)} /><span>{label}</span></label>)}</div></fieldset>
        <fieldset className="survey-question"><legend>3. Qu’est-ce qui vous gêne ou vous manque ? <small>(plusieurs choix possibles)</small></legend><div className="survey-options">{painPointOptions.map(([value, label]) => <label className="survey-choice" key={value}><input type="checkbox" checked={painPoints.includes(value)} onChange={() => togglePainPoint(value)} /><span>{label}</span></label>)}</div></fieldset>
        <label className="field"><span>4. Un champ à ajouter/enlever ou une amélioration à suggérer ? <small>(facultatif)</small></span><textarea rows={3} maxLength={1200} value={suggestion} onChange={(event) => setSuggestion(event.target.value)} placeholder="Décrivez votre idée en quelques mots…" /></label>
        <p id="product-survey-privacy" className="feedback-privacy">Questionnaire proposé une fois à ce navigateur après 5 pages publiques. Pas d’email demandé; ne saisissez aucun nom, identifiant ou renseignement médical. Les superadministrateurs voient les réponses; seule la note agrégée est affichée sur l’accueil.</p>
        {notice && <p className="notice" role="alert">{notice}</p>}
        <div className="feedback-form__footer"><small>{suggestion.length}/1 200 caractères</small><button className="button primary" type="submit" disabled={busy || !rating}>{busy ? "Envoi…" : "Envoyer mes réponses"}</button></div>
      </form>}
    </section>
  </div>;
}
