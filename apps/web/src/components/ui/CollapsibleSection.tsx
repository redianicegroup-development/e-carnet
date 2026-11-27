"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { InfoTip } from "./InfoTip";
import "./info-tip.css";
import "../patient-sections.css";
import "./profile-detail.css";

/* Rubrique repliable des espaces patient, professionnel et établissement.
   Posée dans un `<div className="section-grid">`, elle se présente en tuile (couleur de la palette choisie) (grille de deux colonnes sur téléphone, davantage sur
   grand écran) : le titre est le bouton ; ouverte, la tuile prend toute la largeur de la grille et montre son contenu.
   Hors grille, elle garde l'ancienne présentation en ligne. Le contenu n'est monté qu'à l'ouverture (chargement des données à la demande).
   `hint` (la description de la rubrique) s'affiche dans un « i » posé sur la tuile, et non plus en toutes lettres. */
/* `solo` : le contenu porte déjà, dans sa propre carte, un titre identique à celui du bouton. Ce titre en double est alors masqué
   à l'écran (il reste lu par les technologies d'assistance et garde son id pour aria-labelledby) ; son sur-titre reste visible. */
/* Teinte de la tuile : jamais une couleur propre à la rubrique. Les tuiles prennent les deux couleurs de la PALETTE choisie par la personne : la couleur
   principale (--primary) et la couleur d'accent (--brand-3). Avec la palette par défaut (Miel) ce sont donc son vert et son jaune ; avec une autre palette,
   des teintes proches de ses propres couleurs. Elles alternent en damier dans la grille (voir patient-sections.css) ; `tone` force l'une des deux. */
export type TileTone = "primary" | "accent";

/* `count` : pastille ronde posée sur la tuile fermée (ex. le nombre de demandes en attente) ; la phrase d'`hint` la répète pour les lecteurs d'écran. */
/* `id` : ancre de la rubrique (ex. `/patient/historique#acces`). */
export function CollapsibleSection({ title, children, initiallyOpen = false, solo = false, icon = "folder", hint, alwaysOpen = false, tone, count = 0, id }: {
  title: string; children: ReactNode; initiallyOpen?: boolean; solo?: boolean; icon?: IconName; hint?: string; alwaysOpen?: boolean; tone?: TileTone; count?: number; id?: string;
}) {
  const [openState, setOpen] = useState(initiallyOpen);
  const open = alwaysOpen || openState;
  const panelId = useId();
  if (alwaysOpen) {
    // Section toujours dépliée : pas de bouton, pas de flèche, le contenu est toujours visible.
    return (
      <section className="card carnet-accordion" data-open="true" data-tone={tone} id={id} data-has-info={hint ? "true" : undefined}>
        <h2 className="carnet-accordion__title">
          <span className="carnet-accordion__toggle carnet-accordion__toggle--static">
            <span className="carnet-accordion__badge" aria-hidden="true"><Icon name={icon} size={22} /></span>
            <span className="carnet-accordion__label"><span className="carnet-accordion__name">{title}</span></span>
          </span>
        </h2>
        {hint && <InfoTip label={`Plus d’informations : ${title}`}>{hint}</InfoTip>}
        <div id={panelId} className={`carnet-accordion__panel${solo ? " carnet-accordion__panel--solo" : ""}`}>{children}</div>
      </section>
    );
  }
  return (
    <section className="card carnet-accordion" data-open={open} data-tone={tone} id={id} data-has-info={hint ? "true" : undefined}>
      <h2 className="carnet-accordion__title">
        <button
          className="carnet-accordion__toggle"
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="carnet-accordion__badge" aria-hidden="true"><Icon name={icon} size={22} /></span>
          <span className="carnet-accordion__label"><span className="carnet-accordion__name">{title}</span></span>
          <Icon name="chevron" size={20} />
        </button>
      </h2>
      {/* Le « i » est le voisin du bouton (un bouton n'en contient pas un autre) : la description de la tuile s'ouvre là, plus écrite sur la tuile. */}
      {hint && <InfoTip label={`Plus d’informations : ${title}`}>{hint}</InfoTip>}
      {count > 0 && <span className="carnet-accordion__count" aria-hidden="true">{count > 99 ? "99+" : count}</span>}
      {open && <div id={panelId} className={`carnet-accordion__panel${solo ? " carnet-accordion__panel--solo" : ""}`}>{children}</div>}
    </section>
  );
}

/* Tuile qui ouvre SA PAGE au lieu de se déplier : même présentation que la tuile fermée (décision du 25/11/2026 pour « Ce que je déclare »).
   À poser dans un `<div className="section-grid">`. Pas de contenu : la page de destination porte le formulaire. */
export function TileLink({ href, title, icon = "folder", hint, tone }: { href: string; title: string; icon?: IconName; hint?: string; tone?: TileTone }) {
  return (
    <section className="card carnet-accordion" data-open="false" data-tone={tone} data-has-info={hint ? "true" : undefined}>
      <h2 className="carnet-accordion__title">
        <Link className="carnet-accordion__toggle" href={href}>
          <span className="carnet-accordion__badge" aria-hidden="true"><Icon name={icon} size={22} /></span>
          <span className="carnet-accordion__label"><span className="carnet-accordion__name">{title}</span></span>
          <Icon name="chevron" size={20} />
        </Link>
      </h2>
      {hint && <InfoTip label={`Plus d’informations : ${title}`}>{hint}</InfoTip>}
    </section>
  );
}
