"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../infrastructure/api/client";
import { BREAK_GLASS_API, type EmergencyReviewItem } from "../lib/break-glass";
import "./break-glass.css";

/** Porte d'entrée discrète vers l'accès d'urgence : rien ne s'affiche tant que le serveur ne l'a pas activé (réponse 404). */
export function BreakGlassEntryLink({ role }: { role: "professional" | "establishment" }) {
  const [state, setState] = useState<{ pending: number } | null>(null);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (role === "professional") {
          await apiGet(`${BREAK_GLASS_API}/professional/emergency-access/`);
          if (active) setState({ pending: 0 });
          return;
        }
        const establishments = await apiGet<{ id: string; status: string }[]>("/api/v1/establishments/");
        const current = establishments[0];
        if (!current || current.status !== "active") return;
        const data = await apiGet<{ items: EmergencyReviewItem[] }>(`${BREAK_GLASS_API}/establishment/${current.id}/emergency-access/`);
        if (active) setState({ pending: data.items.filter((item) => item.review_state !== "done").length });
      } catch { /* désactivé, non autorisé ou hors ligne : aucune entrée n'est affichée */ }
    })();
    return () => { active = false; };
  }, [role]);
  if (!state) return null;
  if (role === "professional") return <aside className="card break-glass-entry" aria-label="Accès d’urgence"><p><strong>Patient inconscient ou en danger vital ?</strong> <span className="muted">Accès d’urgence à sa seule fiche d’urgence, motivé et tracé.</span></p><a className="button" href="/professionnel/urgence">Accès d’urgence</a></aside>;
  if (state.pending === 0) return null;
  return <aside className="card break-glass-entry" aria-label="Accès d’urgence à revoir"><p><strong>{state.pending} accès d’urgence à revoir</strong> <span className="muted">Revue attendue sous 72 h.</span></p><a className="button primary" href="/etablissement/urgences">Revoir</a></aside>;
}
