"use client";

import Image from "next/image";
import { Fragment, useEffect, useRef, useState } from "react";
import { HERO_SLIDE_INTERVAL_MS, HERO_SLIDES, HERO_TITLE_GROUPS } from "../../lib/landing-content";

/* Titre du héro avec ses trois petits carrés (voir HERO_TITLE_GROUPS) :
   - « de [a] santé » et « sous [b] votre » : deux diaporamas, une nouvelle photo toutes les 4 s (décalées de 2 s l'une de l'autre),
     choisies au hasard, jamais la même dans les deux carrés en même temps ni deux fois de suite dans le même carré ;
   - « votre [media] contrôle » : emplacement vide, la grande image du héro y démarre puis grossit au défilement (LandingMotion).
   Les carrés sont décoratifs (aria-hidden, alt vide) : le titre lu reste « Votre carnet de santé, sous votre contrôle. ».
   Avec « réduire les animations », les photos ne défilent pas. Le défilement s'arrête aussi quand l'onglet est caché. */

type Deck = { cur: number; prev: number };
type Decks = { a: Deck; b: Deck };

const INITIAL: Decks = { a: { cur: 0, prev: -1 }, b: { cur: 1, prev: -1 } };
const INDEXES = HERO_SLIDES.map((_, index) => index);
const pickFrom = (exclude: number[]) => {
  const pool = INDEXES.filter((index) => !exclude.includes(index));
  return pool[Math.floor(Math.random() * pool.length)] ?? 0;
};

function Slides({ deck, which }: { deck: Deck; which: "a" | "b" }) {
  return (
    <span className="lp-hero__slot lp-hero__slot--slides" data-hero-slot={which} aria-hidden="true">
      {HERO_SLIDES.map((src, index) => (
        <Image key={src} className="lp-hero__slide" data-pos={index === deck.cur ? "in" : index === deck.prev ? "out" : "wait"} src={src} alt="" fill sizes="64px" loading="eager" draggable={false} />
      ))}
    </span>
  );
}

export function HeroTitle() {
  const [decks, setDecks] = useState<Decks>(INITIAL);
  const latest = useRef<Decks>(INITIAL);

  useEffect(() => {
    const commit = (next: Decks) => { latest.current = next; setDecks(next); };
    // Départ au hasard (le serveur rend toujours les deux mêmes photos ; le changement a lieu avant que le titre ne soit visible).
    const frame = requestAnimationFrame(() => {
      const a = pickFrom([]);
      commit({ a: { cur: a, prev: -1 }, b: { cur: pickFrom([a]), prev: -1 } });
    });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => cancelAnimationFrame(frame);

    let turn = 0;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const which = turn++ % 2 === 0 ? "a" : "b";
      const now = latest.current;
      commit({ ...now, [which]: { cur: pickFrom([now.a.cur, now.b.cur, now[which].prev]), prev: now[which].cur } });
    }, HERO_SLIDE_INTERVAL_MS / 2);
    return () => { cancelAnimationFrame(frame); window.clearInterval(timer); };
  }, []);

  return (
    <h1 id="hero-title" className="lp-hero__title">
      {HERO_TITLE_GROUPS.map((group, g) => (
        <Fragment key={g}>
          {g > 0 ? " " : null}
          <span className="lp-hero__tg">
            {group.map((token, t) => (
              <Fragment key={t}>
                {t > 0 ? " " : null}
                {typeof token === "string"
                  ? <span className="lp-hero__w"><span className="lp-hero__wi" data-hero-word>{token}</span></span>
                  : token.slot === "media"
                    ? <span className="lp-hero__slot lp-hero__slot--media" data-hero-slot="media" aria-hidden="true" />
                    : <Slides deck={decks[token.slot]} which={token.slot} />}
              </Fragment>
            ))}
          </span>
        </Fragment>
      ))}
    </h1>
  );
}
