"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { FAQ_ITEMS } from "../../lib/landing-content";
import { Icon } from "../ui/Icon";

/** Durée de la transition d'ouverture (voir .faq-item__panel). Après elle, la hauteur de la page est stable : les repères d'animation sont recalculés. */
const PANEL_TRANSITION_MS = 400;

/** Demande à la landing de recalculer ses repères de défilement : la FAQ change la hauteur de la page en s'ouvrant. */
function announceLayoutChange() {
  window.dispatchEvent(new Event("ecarnet:layout"));
}

/* Six questions, un accordéon : pas de filtres ni de rubriques. Toutes les autres réponses sont dans le centre d'aide (/aide). */
export function FaqSection() {
  const [openId, setOpenId] = useState<string | null>(FAQ_ITEMS[0].id);
  const list = useRef<HTMLDivElement>(null);
  const baseId = useId();

  useEffect(() => {
    const timer = window.setTimeout(announceLayoutChange, PANEL_TRANSITION_MS + 50);
    return () => window.clearTimeout(timer);
  }, [openId]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const buttons = Array.from(list.current?.querySelectorAll<HTMLButtonElement>("button[data-faq-question]") ?? []);
    const index = buttons.findIndex((button) => button === document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    const target = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[target]?.focus();
  }

  return (
    <section className="lp-section lp-wrap lp-faq-section" id="questions" aria-labelledby="faq-title">
      <div className="lp-faq" data-reveal>
        <div className="lp-faq__head">
          <h2 id="faq-title">Les réponses essentielles</h2>
          <p className="lead">Ce qu’on demande le plus avant de créer un espace.</p>
        </div>
        <div className="faq-groups" ref={list} onKeyDown={onKeyDown}>
          {FAQ_ITEMS.map((item) => {
            const open = openId === item.id;
            const buttonId = `${baseId}-q-${item.id}`;
            const panelId = `${baseId}-a-${item.id}`;
            return (
              <div className={`faq-item${open ? " is-open" : ""}`} key={item.id}>
                <h3 className="faq-item__heading">
                  <button type="button" id={buttonId} data-faq-question aria-expanded={open} aria-controls={panelId} onClick={() => setOpenId(open ? null : item.id)}>
                    <span className="faq-item__text">{item.q}</span>
                    <span className="faq-item__icon" aria-hidden="true"><Icon name="plus" size={18} /></span>
                  </button>
                </h3>
                <div className="faq-item__panel" id={panelId} role="region" aria-labelledby={buttonId} inert={!open}>
                  <div className="faq-item__inner">
                    <p>{item.a}</p>
                    {item.link && <Link className="faq-item__link" href={item.link.href}>{item.link.label}<Icon name="chevron" size={14} /></Link>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="lp-faq__more">
          <Link className="button ghost" href="/aide">Toutes les réponses, dans le centre d’aide<Icon name="chevron" size={16} /></Link>
        </p>
      </div>
    </section>
  );
}
