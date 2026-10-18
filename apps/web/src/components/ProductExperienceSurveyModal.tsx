"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ModalIllustration } from "./modal/ModalIllustration";
import { GooLayer } from "./ui/GooLayer";
import { primeCsrf, readCsrfToken } from "../infrastructure/api/client";

const appreciatedOptions = [
  ["organized_carnet", "Carnet clair et organisé"],
  ["consultation_preparation", "Préparation des consultations"],
  ["access_control", "Contrôle des accès"],
  ["history_traceability", "Historique des informations"],
  ["health_content", "Qualité des informations"],
] as const;
const painPointOptions = [
  ["navigation", "Navigation difficile"],
  ["form_fields", "Champs à revoir"],
  ["features", "Fonctionnalité difficile à utiliser"],
  ["clarity", "Libellés peu clairs"],
  ["performance", "Lenteur ou problème technique"],
  ["none", "Aucun point bloquant"],
] as const;
type Props = { open: boolean; onClose: () => void };

export function ProductExperienceSurveyModal({ open, onClose }: Props) {
  const [easeRating, setEaseRating] = useState(0);
  const [appreciated, setAppreciated] = useState<string[]>([]);
  const [painPoints, setPainPoints] = useState<string[]>([]);
  const [suggestion, setSuggestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);
  const dialog = useRef<HTMLElement>(null);
  const firstRating = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(busy);
  useEffect(() => { busyRef.current = busy; }, [busy]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstRating.current?.focus();
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
    if (value === "none") { setPainPoints(painPoints.includes("none") ? [] : ["none"]); return; }
    setPainPoints(painPoints.includes(value) ? painPoints.filter((item) => item !== value) : [...painPoints.filter((item) => item !== "none"), value]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!easeRating) { setNotice("Indiquez la facilité de votre action."); return; }
    setBusy(true); setNotice(""); setFailed(false);
    try {
      const csrf = await primeCsrf();
      if (!csrf.ok) throw new Error("Session de sécurité indisponible. Réessayez.");
      const response = await fetch("/api/v1/identity/feedback2/product/", {
        method: "POST", credentials: "include", cache: "no-store",
        headers: { "Content-Type": "application/json", "X-CSRFToken": readCsrfToken() },
        body: JSON.stringify({ ease_rating: easeRating, appreciated, pain_points: painPoints, improvement_suggestion: suggestion }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? payload.detail ?? "Envoi impossible. Réessayez.");
      setSent(true); setNotice("Merci, votre retour aidera à améliorer le carnet.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Envoi impossible. Réessayez.");
      setFailed(true);
    } finally { setBusy(false); }
  }

  if (!open) return null;
  return <div className="product-survey-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section ref={dialog} className="product-survey-dialog" role="dialog" aria-modal="true" aria-labelledby="product-experience-title" aria-describedby="product-experience-privacy">
      <header className="product-survey-header"><ModalIllustration mood={failed ? "oops" : "listening"} size="sm" /><div><span className="eyebrow">Votre première action</span><h2 id="product-experience-title">Comment s’est-elle passée ?</h2><p className="muted">Quelques réponses pour améliorer le carnet.</p></div><button className="feedback-dialog__close" type="button" aria-label="Fermer le questionnaire" disabled={busy} onClick={onClose}>×</button></header>
      {sent ? <div className="feedback-success"><ModalIllustration mood="success" size="md" /><p className="notice" role="status">{notice}</p><button className="button primary" type="button" onClick={onClose}>Terminer</button></div> : <form className="product-survey-form" onSubmit={submit}>
        <fieldset className="survey-question"><legend>1. Cette tâche était… <span aria-hidden="true">*</span></legend><div className="survey-ease-scale" role="radiogroup" aria-label="Facilité de la tâche, de très difficile à très facile">{[1, 2, 3, 4, 5].map((value, index) => <button ref={index === 0 ? firstRating : undefined} type="button" role="radio" aria-checked={easeRating === value} aria-label={`${value} sur 5`} className="survey-ease-option" key={value} onClick={() => setEaseRating(value)}>{value}</button>)}</div><div className="survey-ease-labels"><span>Très difficile</span><span>Très facile</span></div></fieldset>
        <fieldset className="survey-question"><legend>2. Qu’avez-vous apprécié ? <small>(facultatif)</small></legend><div className="survey-options">{appreciatedOptions.map(([value, label]) => <label className="survey-choice" key={value}><input type="checkbox" checked={appreciated.includes(value)} onChange={() => toggle(appreciated, setAppreciated, value)} /><span>{label}</span></label>)}</div></fieldset>
        <fieldset className="survey-question"><legend>3. Qu’est-ce qui vous a freiné ? <small>(facultatif)</small></legend><div className="survey-options">{painPointOptions.map(([value, label]) => <label className="survey-choice" key={value}><input type="checkbox" checked={painPoints.includes(value)} onChange={() => togglePainPoint(value)} /><span>{label}</span></label>)}</div></fieldset>
        <label className="field"><span>4. Une amélioration à suggérer ? <small>(facultatif)</small></span><textarea rows={3} maxLength={1200} value={suggestion} onChange={(event) => setSuggestion(event.target.value)} placeholder="Une idée en quelques mots…" /></label>
        <p id="product-experience-privacy" className="feedback-privacy">Réponse anonyme, sans email ni identifiant de compte. N’indiquez aucune information personnelle ou médicale.</p>
        {notice && <p className="notice" role="alert">{notice}</p>}
        <div className="feedback-form__footer"><small>{suggestion.length}/1 200</small><button className="button primary" type="submit" disabled={busy || !easeRating}>{busy ? "Envoi…" : "Envoyer"}</button></div>
      </form>}
    </section>
    <GooLayer target={dialog} />
  </div>;
}
