"use client";

import Image from "next/image";
import { Fragment, useEffect, useRef, useState } from "react";
import { HERO_SLIDE_INTERVAL_MS, HERO_SLIDES, HERO_TITLE_LINES, type HeroSlot } from "../../lib/landing-content";

/* Titre du héro = le slogan de l'application, « Gardez le fil avec Mon E‑Carnet. », avec trois petits carrés posés entre les mots :
   - deux diaporamas (a, b) : chacun change de photo toutes les 4 s, décalé de 2 s de l'autre, au hasard, jamais la même photo dans les deux
     carrés en même temps ni deux fois de suite dans le même carré ;
   - le carré « media » est vide : c'est l'emplacement d'où la grande image du héro part puis grossit au défilement (LandingMotion).
   Chaque mot est masqué par un cadre découpé (CSS .lp-hero__w) et monte à l'ouverture (LandingMotion), sans SplitText : le DOM reste celui de React.
   Les carrés sont décoratifs (aria-hidden, alt vide) : le titre lu est le slogan. Avec « réduire les animations », les photos ne défilent pas ;
   le défilement s'arrête aussi quand l'onglet est caché. */

type Deck = { cur: number; prev: number };
type Decks = Record<HeroSlot, Deck>;

const INITIAL: Decks = { a: { cur: 0, prev: -1 }, b: { cur: 1, prev: -1 } };
const INDEXES = HERO_SLIDES.map((_, index) => index);
const pickFrom = (exclude: number[]) => {
  const pool = INDEXES.filter((index) => !exclude.includes(index));
  return pool[Math.floor(Math.random() * pool.length)] ?? 0;
};

function Slides({ deck, which }: { deck: Deck; which: HeroSlot }) {
  return (
    <span className={`lp-hero__slot lp-hero__slot--${which}`} data-hero-slot={which} aria-hidden="true">
      {HERO_SLIDES.map((src, index) => (
        <Image key={src} className="lp-hero__slide" data-pos={index === deck.cur ? "in" : index === deck.prev ? "out" : "wait"} src={src} alt="" fill sizes="(max-width: 759px) 72px, 112px" loading="eager" draggable={false} />
      ))}
    </span>
  );
}

export function HeroTitle() {
  const [decks, setDecks] = useState<Decks>(INITIAL);
  const latest = useRef<Decks>(INITIAL);

  useEffect(() => {
    const commit = (next: Decks) => { latest.current = next; setDecks(next); };
    // Départ au hasard (le serveur rend toujours les mêmes photos ; le changement a lieu avant que les carrés ne soient visibles).
    const frame = requestAnimationFrame(() => {
      const a = pickFrom([]);
      commit({ a: { cur: a, prev: -1 }, b: { cur: pickFrom([a]), prev: -1 } });
    });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => cancelAnimationFrame(frame);

    let turn = 0;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const which: HeroSlot = turn++ % 2 === 0 ? "a" : "b";
      const now = latest.current;
      commit({ ...now, [which]: { cur: pickFrom([now.a.cur, now.b.cur, now[which].prev]), prev: now[which].cur } });
    }, HERO_SLIDE_INTERVAL_MS / 2);
    return () => { cancelAnimationFrame(frame); window.clearInterval(timer); };
  }, []);

  return (
    <h1 id="hero-title" className="lp-hero__title">
      {HERO_TITLE_LINES.map((line, l) => (
        <span className="lp-hero__line" key={l}>
          {line.map((item, i) => (
            <Fragment key={i}>
              {i > 0 ? " " : null}
              {typeof item === "string"
                ? <span className="lp-hero__w"><span className="lp-hero__wi" data-hero-word>{item}</span></span>
                : item.tile === "media"
                  ? <span className="lp-hero__slot lp-hero__slot--media" data-hero-slot="media" aria-hidden="true" />
                  : <Slides deck={decks[item.tile]} which={item.tile} />}
            </Fragment>
          ))}
        </span>
      ))}
    </h1>
  );
}
