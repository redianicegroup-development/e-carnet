"use client";

import { useId, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import "../patient-sections.css";

/* Rubrique repliable des espaces patient, professionnel et établissement.
   Posée dans un `<div className="section-grid">`, elle se présente en tuile (couleur de la palette choisie) (grille de deux colonnes sur téléphone, davantage sur
   grand écran) : le titre est le bouton ; ouverte, la tuile prend toute la largeur de la grille et montre son contenu.
   Hors grille, elle garde l'ancienne présentation en ligne. Le contenu n'est monté qu'à l'ouverture (chargement des données à la demande). */
/* `solo` : le contenu porte déjà, dans sa propre carte, un titre identique à celui du bouton. Ce titre en double est alors masqué
   à l'écran (il reste lu par les technologies d'assistance et garde son id pour aria-labelledby) ; son sur-titre reste visible. */
export function CollapsibleSection({ title, children, initiallyOpen = false, solo = false, icon = "folder", hint }: {
  title: string; children: ReactNode; initiallyOpen?: boolean; solo?: boolean; icon?: IconName; hint?: string;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const panelId = useId();
  return (
    <section className="card carnet-accordion" data-open={open}>
      <h2 className="carnet-accordion__title">
        <button
          className="carnet-accordion__toggle"
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="carnet-accordion__badge" aria-hidden="true"><Icon name={icon} size={22} /></span>
          <span className="carnet-accordion__label"><span className="carnet-accordion__name">{title}</span>{hint && <small className="carnet-accordion__hint">{hint}</small>}</span>
          <Icon name="chevron" size={20} />
        </button>
      </h2>
      {open && <div id={panelId} className={`carnet-accordion__panel${solo ? " carnet-accordion__panel--solo" : ""}`}>{children}</div>}
    </section>
  );
}
