"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { FAQ_GROUPS, FAQ_ITEMS, type FaqGroup } from "../../lib/landing-content";
import { Icon } from "../ui/Icon";

const ALL = "all";
const idsFor = (key: string) => (key === ALL ? FAQ_GROUPS : FAQ_GROUPS.filter((item) => item.id === key)).flatMap((item) => item.items.map((entry) => entry.id));
/** Durée de la transition d'ouverture (voir .faq-item__panel). Après elle, la hauteur de la page est stable : les repères d'animation sont recalculés. */
const PANEL_TRANSITION_MS = 400;

/** Demande à la landing de recalculer ses repères de défilement : la FAQ change la hauteur de la page en s'ouvrant. */
function announceLayoutChange() {
  window.dispatchEvent(new Event("ecarnet:layout"));
}

export function FaqSection() {
  const [group, setGroup] = useState<string>(ALL);
  const [openId, setOpenId] = useState<string | null>(FAQ_ITEMS[0].id);
  const list = useRef<HTMLDivElement>(null);
  const baseId = useId();

  const groups: FaqGroup[] = group === ALL ? FAQ_GROUPS : FAQ_GROUPS.filter((item) => item.id === group);
  const activeId = openId && idsFor(group).includes(openId) ? openId : null; // une question masquée par le filtre n'est plus « ouverte »

  useEffect(() => {
    const timer = window.setTimeout(announceLayoutChange, PANEL_TRANSITION_MS + 50);
    return () => window.clearTimeout(timer);
  }, [group, activeId]);

  function changeGroup(next: string) {
    setGroup(next);
    const ids = idsFor(next);
    if (openId && !ids.includes(openId)) setOpenId(ids[0] ?? null); // la question ouverte vient d'être masquée : on ouvre la première de la rubrique
  }

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

  // Sur mobile la carte d'aide passe après les questions (sinon elle les repousse sous l'écran) ; sur grand écran elle reste dans la colonne de gauche.
  const helpCard = (variant: string) => (
    <div className={`faq-help ${variant}`}>
      <strong>Vous ne trouvez pas votre réponse ?</strong>
      <p>Écrivez-nous : nous vous répondons par le moyen que vous indiquez.</p>
      <a className="button primary" href="#contact">Nous écrire<Icon name="chevron" size={16} /></a>
    </div>
  );
  const numbers = new Map(groups.flatMap((section) => section.items).map((item, index) => [item.id, index + 1]));
  return (
    <section className="lp-section lp-wrap lp-faq-section" id="questions" aria-labelledby="faq-title">
      <div className="lp-faq-layout">
        <div className="lp-faq-aside" data-reveal>
          <span className="eyebrow">Réponses claires</span>
          <h2 id="faq-title">Questions fréquentes sur E‑Carnet</h2>
          <p className="lead">Les informations essentielles avant de créer votre espace.</p>
          <div className="faq-filters" role="group" aria-label="Filtrer les questions par rubrique">
            <button type="button" className="faq-filter" aria-pressed={group === ALL} onClick={() => changeGroup(ALL)}>Toutes<small>{FAQ_ITEMS.length}</small></button>
            {FAQ_GROUPS.map((item) => <button type="button" className="faq-filter" key={item.id} aria-pressed={group === item.id} onClick={() => changeGroup(item.id)}>{item.title}<small>{item.items.length}</small></button>)}
          </div>
          {helpCard("faq-help--aside")}
        </div>

        <div className="faq-groups" ref={list} onKeyDown={onKeyDown}>
          {groups.map((section) => (
            <div className="faq-group" key={section.id}>
              {group === ALL && <h3 className="faq-group__title">{section.title}</h3>}
              {section.items.map((item) => {
                const open = activeId === item.id;
                const buttonId = `${baseId}-q-${item.id}`;
                const panelId = `${baseId}-a-${item.id}`;
                return (
                  <div className={`faq-item${open ? " is-open" : ""}`} key={item.id}>
                    <h4 className="faq-item__heading">
                      <button type="button" id={buttonId} data-faq-question aria-expanded={open} aria-controls={panelId} onClick={() => setOpenId(open ? null : item.id)}>
                        <span className="faq-item__num" aria-hidden="true">{String(numbers.get(item.id)).padStart(2, "0")}</span>
                        <span className="faq-item__text">{item.q}</span>
                        <span className="faq-item__icon" aria-hidden="true"><Icon name="plus" size={18} /></span>
                      </button>
                    </h4>
                    <div className="faq-item__panel" id={panelId} role="region" aria-labelledby={buttonId} inert={!open}>
                      <div className="faq-item__inner">
                        <p>{item.a}</p>
                        {item.link && <a className="faq-item__link" href={item.link.href} {...(item.link.subject ? { "data-contact-subject": item.link.subject } : {})}>{item.link.label}<Icon name="chevron" size={14} /></a>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          {helpCard("faq-help--after")}
          <Link className="lp-more" href="/faq">Voir toutes les questions et les guides <Icon name="chevron" size={16} /></Link>
        </div>
      </div>
    </section>
  );
}
