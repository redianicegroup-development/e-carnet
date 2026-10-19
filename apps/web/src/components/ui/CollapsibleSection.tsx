"use client";

import { useState, type ReactNode } from "react";

export function CollapsibleSection({ title, children, initiallyOpen = false }: { title: string; children: ReactNode; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const panelId = `panel-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section className="card carnet-accordion">
      <button
        className="carnet-accordion__toggle"
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{title}</span>
        <span className="carnet-accordion__action" aria-hidden="true">{open ? "− Masquer" : "+ Afficher"}</span>
      </button>
      {open && <div id={panelId} className="carnet-accordion__panel">{children}</div>}
    </section>
  );
}
