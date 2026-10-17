"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ModalIllustration } from "./modal/ModalIllustration";

const barrierOptions = [
  ["purpose", "Je ne vois pas encore à quoi ça sert"],
  ["health_privacy", "La confidentialité de mes données m’inquiète"],
  ["pricing", "Le prix n’est pas clair"],
  ["steps", "Les démarches me semblent trop longues"],
  ["none", "Rien pour le moment"],
  ["other", "Autre raison"],
] as const;

const personaOptions = [
  ["patient", "Patient ou proche"],
  ["professional", "Professionnel de santé"],
  ["establishment", "Établissement de santé"],
  ["discovery", "Je découvre Mon E‑Carnet"],
] as const;

type Props = { open: boolean; onClose: () => void };

export function ProductSurveyModal({ open, onClose }: Props) {
  const [persona, setPersona] = useState("");
  const [foundWhat, setFoundWhat] = useState("");
  const [barriers, setBarriers] = useState<string[]>([]);
  const [missing, setMissing] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);
  const dialog = useRef<HTMLElement>(null);
  const firstField = useRef<HTMLSelectElement>(null);
  const busyRef = useRef(busy);
  useEffect(() => { busyRef.current = busy; }, [busy]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstField.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) onClose();
      if (event.key !== "Tab") return;
      const focusable = dialog.current?.querySelectorAll<HTMLElement>("button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled])");
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

  function toggleBarrier(value: string) {
    if (value === "none") { setBarriers(barriers.includes("none") ? [] : ["none"]); return; }
    setBarriers(barriers.includes(value) ? barriers.filter((item) => item !== value) : [...barriers.filter((item) => item !== "none"), value]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!persona || !foundWhat) { setNotice("Répondez aux deux premières questions pour continuer."); return; }
    setBusy(true); setNotice(""); setFailed(false);
    try {
      const response = await fetch("/api/v1/identity/feedback2/", {
        method: "POST", credentials: "include", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona, found_what: foundWhat, barriers, missing }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? payload.detail ?? "Envoi impossible. Réessayez.");
      setSent(true);
      setNotice("Merci, votre réponse nous aidera à rendre le site plus clair.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Envoi impossible. Réessayez.");
      setFailed(true);
    } finally { setBusy(false); }
  }

  if (!open) return null;
  return <div className="product-survey-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section ref={dialog} className="product-survey-dialog" role="dialog" aria-modal="true" aria-labelledby="product-survey-title" aria-describedby="product-survey-privacy">
      <header className="product-survey-header"><ModalIllustration mood={failed ? "oops" : "listening"} size="sm" /><div><span className="eyebrow">Votre avis</span><h2 id="product-survey-title">Qu’est-ce qui vous aiderait ?</h2><p className="muted">Quatre questions rapides sur votre visite.</p></div><button className="feedback-dialog__close" type="button" aria-label="Fermer le questionnaire" disabled={busy} onClick={onClose}>×</button></header>
      {sent ? <div className="feedback-success"><ModalIllustration mood="success" size="md" /><p className="notice" role="status">{notice}</p><button className="button primary" type="button" onClick={onClose}>Terminer</button></div> : <form className="product-survey-form" onSubmit={submit}>
        <label className="field"><span>1. Vous êtes plutôt…</span><select ref={firstField} required value={persona} onChange={(event) => setPersona(event.target.value)}><option value="">Choisir</option>{personaOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <fieldset className="survey-question"><legend>2. Avez-vous trouvé ce que vous cherchiez ?</legend><div className="survey-options">{[["yes", "Oui"], ["partly", "En partie"], ["no", "Non"]].map(([value, label]) => <label className="survey-choice" key={value}><input required type="radio" name="found-what" value={value} checked={foundWhat === value} onChange={() => setFoundWhat(value)} /><span>{label}</span></label>)}</div></fieldset>
        <fieldset className="survey-question"><legend>3. Qu’est-ce qui vous retiendrait de créer un compte ? <small>(plusieurs choix possibles)</small></legend><div className="survey-options">{barrierOptions.map(([value, label]) => <label className="survey-choice" key={value}><input type="checkbox" checked={barriers.includes(value)} onChange={() => toggleBarrier(value)} /><span>{label}</span></label>)}</div></fieldset>
        <label className="field"><span>4. Qu’est-ce qui manque sur le site ? <small>(facultatif)</small></span><textarea rows={3} maxLength={1200} value={missing} onChange={(event) => setMissing(event.target.value)} placeholder="Une idée en quelques mots…" /></label>
        <p id="product-survey-privacy" className="feedback-privacy">Réponse anonyme, sans adresse email. N’indiquez aucune information personnelle ou médicale.</p>
        {notice && <p className="notice" role="alert">{notice}</p>}
        <div className="feedback-form__footer"><small>{missing.length}/1 200</small><button className="button primary" type="submit" disabled={busy || !persona || !foundWhat}>{busy ? "Envoi…" : "Envoyer"}</button></div>
      </form>}
    </section>
  </div>;
}
