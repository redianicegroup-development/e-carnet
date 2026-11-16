"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { HERO_SLIDE_INTERVAL_MS, HERO_SLIDES, HERO_SLOTS, type HeroSlot } from "../../lib/landing-content";

/* Décor du héro : le grand « MON E‑CARNET » en filigrane (le même que celui du pied de page) et, autour, des petits carrés de photos.
   - quatre carrés (a, b, c, d) sont des diaporamas : chacun change de photo toutes les 4 s, décalé d'1 s du précédent, au hasard,
     jamais la même photo dans deux carrés en même temps ni deux fois de suite dans le même carré ;
   - le carré « media » est vide : c'est l'emplacement d'où la grande image du héro part puis grossit au défilement (LandingMotion).
   Tout est décoratif (aria-hidden, alt vide) : le titre lu est le slogan (HeroTitle). Avec « réduire les animations », les photos ne défilent pas.
   Le défilement s'arrête aussi quand l'onglet est caché. */

type Deck = { cur: number; prev: number };
type Decks = Record<HeroSlot, Deck>;

const INITIAL = Object.fromEntries(HERO_SLOTS.map((slot, index) => [slot, { cur: index, prev: -1 }])) as Decks;
const INDEXES = HERO_SLIDES.map((_, index) => index);
const pickFrom = (exclude: number[]) => {
  const pool = INDEXES.filter((index) => !exclude.includes(index));
  return pool[Math.floor(Math.random() * pool.length)] ?? 0;
};

function Slides({ deck, which }: { deck: Deck; which: HeroSlot }) {
  return (
    <span className={`lp-hero__slot lp-hero__slot--${which}`} data-hero-slot={which} aria-hidden="true">
      {HERO_SLIDES.map((src, index) => (
        <Image key={src} className="lp-hero__slide" data-pos={index === deck.cur ? "in" : index === deck.prev ? "out" : "wait"} src={src} alt="" fill sizes="(max-width: 759px) 96px, 176px" loading="eager" draggable={false} />
      ))}
    </span>
  );
}

export function HeroTiles() {
  const [decks, setDecks] = useState<Decks>(INITIAL);
  const latest = useRef<Decks>(INITIAL);

  useEffect(() => {
    const commit = (next: Decks) => { latest.current = next; setDecks(next); };
    // Départ au hasard (le serveur rend toujours les mêmes photos ; le changement a lieu avant que les carrés ne soient visibles).
    const frame = requestAnimationFrame(() => {
      const taken: number[] = [];
      const start = {} as Decks;
      for (const slot of HERO_SLOTS) {
        const cur = pickFrom(taken);
        taken.push(cur);
        start[slot] = { cur, prev: -1 };
      }
      commit(start);
    });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => cancelAnimationFrame(frame);

    let turn = 0;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const which = HERO_SLOTS[turn++ % HERO_SLOTS.length];
      const now = latest.current;
      const visible = HERO_SLOTS.map((slot) => now[slot].cur);
      commit({ ...now, [which]: { cur: pickFrom([...visible, now[which].prev]), prev: now[which].cur } });
    }, HERO_SLIDE_INTERVAL_MS / HERO_SLOTS.length);
    return () => { cancelAnimationFrame(frame); window.clearInterval(timer); };
  }, []);

  return (
    <div className="lp-hero__stage" aria-hidden="true">
      <p className="lp-hero__mark notranslate" translate="no" data-hero-mark><span>MON</span> <span>E‑CARNET</span></p>
      {HERO_SLOTS.map((slot) => <Slides key={slot} deck={decks[slot]} which={slot} />)}
      <span className="lp-hero__slot lp-hero__slot--media" data-hero-slot="media" />
    </div>
  );
}
