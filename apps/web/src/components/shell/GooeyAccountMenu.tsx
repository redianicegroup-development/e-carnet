"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { MenuEntry, SidebarAvatar, type SidebarAccount, type SidebarMenuItem } from "./AppSidebar";

/* Menu du compte de la barre haute mobile : le bouton rond (avatar) se déploie en un panneau doux (même matière que la page), relié au bouton par un col de matière
   (filtre SVG « gooey », défini une fois dans GooeyFilters). Inspiré du menu à goutte de l'exemple Gemini, adapté au tactile :
   il s'ouvre au toucher (pas au survol), se ferme avec Échap ou en touchant ailleurs, et rend le focus au bouton.
   Le mouvement vit entièrement dans soft-skin.css (transitions + ressort) ; ici on ne mesure que la taille du contenu. */
export function GooeyAccountMenu({ account, menu, notice }: { account: SidebarAccount; menu: SidebarMenuItem[]; notice?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  // Taille du panneau ouvert = taille naturelle du contenu (largeur bornée à l'écran, hauteur mesurée).
  useEffect(() => {
    const host = root.current;
    const inner = content.current;
    if (!host || !inner) return;
    const measure = () => {
      host.style.setProperty("--gm-w", `${Math.min(300, window.innerWidth - 32)}px`);
      host.style.setProperty("--gm-h", `${inner.offsetHeight}px`);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(inner);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [menu, account.email, notice]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    const focusTimer = window.setTimeout(() => root.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus(), 80);
    return () => { document.removeEventListener("pointerdown", onPointerDown); window.clearTimeout(focusTimer); };
  }, [open]);

  function close(returnFocus = false) {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); close(true); return; }
    if (event.key === "Tab") { setOpen(false); return; }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") return;
    const entries = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)'));
    if (entries.length === 0) return;
    const current = entries.indexOf(document.activeElement as HTMLElement);
    let next = 0;
    if (event.key === "ArrowDown") next = (current + 1) % entries.length;
    else if (event.key === "ArrowUp") next = (current - 1 + entries.length) % entries.length;
    else if (event.key === "End") next = entries.length - 1;
    event.preventDefault();
    entries[next].focus();
  }

  const safe = menu.filter((entry) => entry.tone !== "danger");
  const danger = menu.filter((entry) => entry.tone === "danger");
  let index = 0;
  const step = () => ({ "--i": index++ } as React.CSSProperties);
  return (
    <div className="gm" ref={root} data-open={open}>
      <span className="gm__goo" aria-hidden="true"><i className="gm__anchor" /><i className="gm__blob" /></span>
      <div className="gm__panel" id={panelId} role="menu" aria-label={`Compte de ${account.name}`} inert={!open} onKeyDown={onKeyDown}>
        <div className="gm__content" ref={content}>
          <p className="gm__who gm__item" style={step()}><strong>{account.name}</strong>{account.email && <small>{account.email}</small>}</p>
          {safe.map((entry) => <div className="gm__item" style={step()} key={entry.id}><MenuEntry entry={entry} onDone={() => close()} /></div>)}
          {danger.length > 0 && <div className="gm__sep gm__item" style={step()} role="separator" />}
          {danger.map((entry) => <div className="gm__item" style={step()} key={entry.id}><MenuEntry entry={entry} onDone={() => close()} /></div>)}
          {notice && <p className="gm__notice gm__item" style={step()} role="alert">{notice}</p>}
        </div>
      </div>
      <button ref={trigger} type="button" className="gm__trigger" data-tour="account" aria-haspopup="menu" aria-expanded={open} aria-controls={panelId} aria-label={open ? "Fermer le menu du compte" : `Ouvrir le menu du compte de ${account.name}`} onClick={() => setOpen((value) => !value)}>
        <SidebarAvatar account={account} />
      </button>
    </div>
  );
}
