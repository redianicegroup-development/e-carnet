import { Fragment } from "react";
import { HERO_TITLE_GROUPS } from "../../lib/landing-content";

/* Titre du héro = le slogan de l'application, « Gardez le fil avec Mon E‑Carnet. », posé en bas de l'écran au-dessus du bouton.
   Chaque mot est masqué par un cadre découpé (CSS .lp-hero__w) et monte à l'ouverture (LandingMotion), sans SplitText : le DOM reste celui de React.
   Les photos qui flottent autour du grand « MON E‑CARNET » sont dans HeroTiles. */
export function HeroTitle() {
  return (
    <h1 id="hero-title" className="lp-hero__title">
      {HERO_TITLE_GROUPS.map((group, g) => (
        <Fragment key={g}>
          {g > 0 ? " " : null}
          <span className="lp-hero__tg">
            {group.map((word, t) => (
              <Fragment key={t}>
                {t > 0 ? " " : null}
                <span className="lp-hero__w"><span className="lp-hero__wi" data-hero-word>{word}</span></span>
              </Fragment>
            ))}
          </span>
        </Fragment>
      ))}
    </h1>
  );
}
