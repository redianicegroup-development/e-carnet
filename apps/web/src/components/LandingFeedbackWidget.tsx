"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./ui/Icon";
import { ModalIllustration } from "./modal/ModalIllustration";
import { GooLayer } from "./ui/GooLayer";

type FeedbackCategory = "bug" | "idea" | "question" | "other";

export function LandingFeedbackWidget({ inline = false }: { inline?: boolean }) {
  const pathname = usePathname();
  const inWorkspace = /^\/(patient|professionnel|etablissement|admin|staff)(\/|$)/.test(pathname);
  // Pas de bouton flottant pendant l’authentification, la récupération ou l’onboarding : priorité à la saisie du parcours.
  const onAuthPage = /^\/(connexion|inscription|onboarding)(\/|$)/.test(pathname);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>("idea");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow; // même verrouillage que les autres fenêtres : la page derrière ne défile pas
    document.body.style.overflow = "hidden";
    textarea.current?.focus();
    if (!textarea.current) dialog.current?.querySelector<HTMLAnchorElement>("a[href]")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) close();
      if (event.key === "Tab") {
        const focusable = dialog.current?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], select:not([disabled]), textarea:not([disabled])");
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!dialog.current?.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
        else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previousOverflow; };
  }, [open, busy]);

  function close() {
    setOpen(false);
    window.setTimeout(() => opener.current?.focus(), 0);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setNotice(""); setFailed(false);
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
      setSent(true); setNotice("Merci, votre retour a bien été transmis à l’équipe Mon E‑Carnet.");
      setMessage("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Envoi impossible. Réessayez plus tard.");
      setFailed(true);
    } finally { setBusy(false); }
  }

  return <>
    {(inline || (!inWorkspace && !onAuthPage)) && <button ref={opener} type="button" className={inline ? "button primary feedback-inline-trigger" : "button feedback-fab"} aria-label="Donner votre avis" aria-haspopup="dialog" aria-expanded={open} data-track="feedback_open" onClick={() => { setOpen(true); setCategory("idea"); setSent(false); setNotice(""); }}>
      <Icon name="pencil" size={18} /><span>Donner votre avis</span>
    </button>}
    {open && <div className="feedback-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) close(); }}>
      <section ref={dialog} className="feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-title" aria-describedby={category === "question" ? undefined : "feedback-privacy"}>
        <header className="feedback-dialog__header"><ModalIllustration mood={category === "question" ? "question" : failed ? "oops" : "listening"} size="sm" /><div><span className="eyebrow">Mon E‑Carnet</span><h2 id="feedback-title">Votre avis</h2></div><button className="feedback-dialog__close" type="button" aria-label="Fermer le formulaire" disabled={busy} onClick={close}>×</button></header>
        {category === "question" && !sent ? <div className="feedback-success"><p>Retrouvez les réponses et guides dans le centre d’aide.</p><div className="actions"><Link className="button primary" href="/aide" onClick={close}>Ouvrir le centre d’aide</Link><button className="button" type="button" onClick={close}>Fermer</button></div></div> : sent ? <div className="feedback-success"><ModalIllustration mood="success" size="md" /><p className="notice" role="status">{notice}</p><button className="button primary" type="button" onClick={close}>Fermer</button></div> : <form className="feedback-form" onSubmit={submit}>
          <label className="field"><span>Type de retour</span><select value={category} onChange={(event) => setCategory(event.target.value as FeedbackCategory)}><option value="idea">Suggestion</option><option value="bug">Signaler un problème</option><option value="question">Question</option><option value="other">Autre</option></select></label>
          <label className="field"><span>Votre message</span><textarea ref={textarea} required minLength={5} maxLength={2000} rows={5} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Décrivez le problème ou votre idée…" /></label>
          <p id="feedback-privacy" className="feedback-privacy">Retour anonyme. N’indiquez aucun nom, identifiant ou renseignement médical.</p>
          {notice && <p className="notice" role="alert">{notice}</p>}
          <div className="feedback-form__footer"><small>{message.length}/2 000 caractères</small><button className="button primary" type="submit" disabled={busy || message.trim().length < 5}>{busy ? "Envoi…" : "Envoyer le retour"}</button></div>
        </form>}
      </section>
      <GooLayer target={dialog} />
    </div>}
  </>;
}
