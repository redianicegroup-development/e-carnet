"use client";

import { useState } from "react";

/* Export complet du carnet (PAT-09) : on choisit la période, on lit l'avertissement, puis on télécharge en Excel (ou en PDF).
   Le fichier est généré par le serveur, journalisé, et n'est jamais mis en cache. Sans date : tout le carnet. */
const isoToday = () => new Date().toISOString().slice(0, 10);

export function PatientCarnetExport() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [understood, setUnderstood] = useState(false);
  const reversed = Boolean(from && to && from > to);
  const ready = understood && !reversed;
  const params = new URLSearchParams({ format: "xlsx" });
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  return (
    <section className="card" aria-labelledby="carnet-export-title">
      <div className="section-heading"><div><span className="eyebrow">Portabilité</span><h3 id="carnet-export-title">Exporter mon carnet</h3></div></div>
      <p className="muted">Choisissez la période à exporter, ou laissez les dates vides pour tout le carnet. Le fichier Excel contient une feuille par rubrique : déclarations, vaccinations, mesures, consultations validées, documents (liste seulement), rappels, prises et rendez-vous.</p>
      <div className="grid two">
        <label className="field"><span>Du</span><input type="date" value={from} max={to || isoToday()} onChange={(event) => setFrom(event.target.value)} /></label>
        <label className="field"><span>Au</span><input type="date" value={to} min={from || undefined} max={isoToday()} onChange={(event) => setTo(event.target.value)} /></label>
      </div>
      {reversed ? <p className="notice notice--error" role="alert">La date de fin doit suivre la date de début.</p> : null}
      <p className="notice" role="note">Ce fichier contient des informations de santé et n’est pas chiffré. Gardez-le en lieu sûr, ne l’envoyez que par un canal que vous maîtrisez et supprimez-le quand vous n’en avez plus besoin.</p>
      <label className="check"><input type="checkbox" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} /> J’ai compris, je veux exporter mon carnet.</label>
      <div className="actions">
        <a className={`button primary${ready ? "" : " is-disabled"}`} href={ready ? `/api/v1/patient/care/export/?${params.toString()}` : undefined} aria-disabled={!ready} role={ready ? undefined : "link"} onClick={(event) => { if (!ready) event.preventDefault(); }}>Télécharger en Excel</a>
        <a className={`button${understood ? "" : " is-disabled"}`} href={understood ? "/api/v1/patient/care/export/" : undefined} aria-disabled={!understood} role={understood ? undefined : "link"} onClick={(event) => { if (!understood) event.preventDefault(); }}>Télécharger en PDF</a>
      </div>
    </section>
  );
}
