"use client";

import { useId, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import "../patient-sections.css";

/* Rubrique repliable de l'espace patient. Même geste que « Ma carte virtuelle » : le titre est le bouton, le chevron
   pivote d'un quart de tour à l'ouverture. Le contenu n'est monté qu'à l'ouverture (chargement des données à la demande). */
export function CollapsibleSection({ title, children, initiallyOpen = false }: { title: string; children: ReactNode; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const panelId = useId();
  return (
    <section className="card carnet-accordion">
      <h2 className="carnet-accordion__title">
        <button
          className="carnet-accordion__toggle"
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <span>{title}</span>
          <Icon name="chevron" size={20} />
        </button>
      </h2>
      {open && <div id={panelId} className="carnet-accordion__panel">{children}</div>}
    </section>
  );
}
