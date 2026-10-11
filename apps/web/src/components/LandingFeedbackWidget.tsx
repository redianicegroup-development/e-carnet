"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type FeedbackCategory = "bug" | "idea" | "question" | "other";

export function LandingFeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>("idea");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [sent, setSent] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    textarea.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) close();
      if (event.key === "Tab") {
        const focusable = dialog.current?.querySelectorAll<HTMLElement>("button:not([disabled]), select:not([disabled]), textarea:not([disabled])");
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!dialog.current?.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
        else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, busy]);

  function close() {
    setOpen(false);
    window.setTimeout(() => opener.current?.focus(), 0);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/v1/identity/feedback/", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, message, path: window.location.pathname }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? payload.detail ?? "Envoi impossible. Réessayez plus tard.");
      setSent(true); setNotice("Merci, votre retour a bien été transmis à l’équipe E‑Carnet.");
      setMessage("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Envoi impossible. Réessayez plus tard.");
    } finally { setBusy(false); }
  }

  return <>
    <button ref={opener} type="button" className="feedback-fab" aria-haspopup="dialog" aria-expanded={open} data-track="feedback_open" onClick={() => { setOpen(true); setSent(false); setNotice(""); }}>
      <span aria-hidden="true">✎</span><span>Votre avis</span>
    </button>
    {open && <div className="feedback-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) close(); }}>
      <section ref={dialog} className="feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-title" aria-describedby="feedback-privacy">
        <header className="feedback-dialog__header"><div><span className="eyebrow">E‑Carnet · Feedback</span><h2 id="feedback-title">Aidez-nous à améliorer le site</h2></div><button className="feedback-dialog__close" type="button" aria-label="Fermer le formulaire" disabled={busy} onClick={close}>×</button></header>
        {sent ? <div className="feedback-success"><p className="notice" role="status">{notice}</p><button className="button primary" type="button" onClick={close}>Fermer</button></div> : <form className="feedback-form" onSubmit={submit}>
          <label className="field"><span>Type de retour</span><select value={category} onChange={(event) => setCategory(event.target.value as FeedbackCategory)}><option value="idea">Suggestion</option><option value="bug">Signaler un problème</option><option value="question">Question</option><option value="other">Autre</option></select></label>
          <label className="field"><span>Votre message</span><textarea ref={textarea} required minLength={5} maxLength={2000} rows={5} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Dites-nous ce qui vous aiderait…" /></label>
          <p id="feedback-privacy" className="feedback-privacy">Retour anonyme, sans adresse email. N’incluez pas de nom, d’identifiant ni d’information médicale. Votre message sera visible par l’équipe d’administration.</p>
          {notice && <p className="notice" role="alert">{notice}</p>}
          <div className="feedback-form__footer"><small>{message.length}/2 000 caractères</small><button className="button primary" type="submit" disabled={busy || message.trim().length < 5}>{busy ? "Envoi…" : "Envoyer le retour"}</button></div>
        </form>}
      </section>
    </div>}
  </>;
}
