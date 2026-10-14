"use client";

import { AdminEstablishmentsClient } from "./AdminEstablishmentsClient";

/* Console équipe (/staff/etablissements) : même contenu que l'onglet « Établissements » du tableau de bord admin. */
export function StaffEstablishmentConsole() {
  return (
    <div className="hero-page">
      <span className="eyebrow">Console privée · E‑Carnet</span>
      <h1>Vérifier une structure et créer son accès</h1>
      <p className="notice" role="note">Cette console est réservée à l’équipe E‑Carnet authentifiée.</p>
      <div className="grid admin-management-grid">
        <AdminEstablishmentsClient />
      </div>
    </div>
  );
}
