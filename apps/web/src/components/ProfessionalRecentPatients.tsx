"use client";

import { useEffect, useState } from "react";
import { ApiError, apiGet } from "../infrastructure/api/client";
import { formatDay, formatWhen } from "./access/access-history";
import { ListSearchBar } from "./list/ListSearchBar";
import { useListFilter } from "./list/useListFilter";
import { PersonAvatar } from "./ui/PersonAvatar";
import { RECENT_LIMIT, RECENT_PATIENTS_PATH, RECENT_RETENTION_DAYS, RECENT_SEARCH_FROM, listedUntil, parseRecentPatients, recentPatientName, type RecentPatient } from "../lib/recent-patients";
import { matchesQuery } from "../lib/list-filter";
import "./recent-patients.css";

/* PRO-15 — « Patients reçus récemment » : mémoire de travail du professionnel, sans dossier.
   Chaque ligne = un nom et la date du dernier accès. Aucun identifiant, aucun état, aucune donnée médicale n'est affiché ni conservé.
   Un accès terminé ne se rouvre jamais ici : l'unique action est une NOUVELLE demande d'accès (QR), qui repasse par le consentement du patient. */

type View = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; rows: RecentPatient[] };

export function ProfessionalRecentPatients() {
  const [view, setView] = useState<View>({ status: "loading" });
  const { state: listFilter, patch: patchFilter, reset: resetFilter, filtered: listFiltered } = useListFilter();

  useEffect(() => {
    let active = true;
    apiGet<unknown>(RECENT_PATIENTS_PATH)
      .then((payload) => { if (active) setView({ status: "ready", rows: parseRecentPatients(payload) }); })
      .catch((error: unknown) => {
        if (!active) return;
        const message = error instanceof ApiError && error.status === 403 ? error.message || "Choisissez un établissement actif pour voir vos patients récents." : "Impossible de charger les patients récents. Réessayez.";
        setView({ status: "error", message });
      });
    return () => { active = false; };
  }, []);

  function newRequest() {
    // Déjà sur « #scanner » : le navigateur n'émet pas hashchange, la demande doit pourtant se rouvrir.
    if (window.location.hash === "#scanner") window.dispatchEvent(new HashChangeEvent("hashchange"));
  }

  const rows = view.status === "ready" ? view.rows : [];
  const visible = rows.filter((row) => matchesQuery([row.first_name, row.last_name], listFilter.query));

  return <section className="card recent-patients" aria-labelledby="recent-patients-title">
    <div className="section-heading"><div><h2 id="recent-patients-title">Patients reçus récemment</h2><p className="muted">Les {RECENT_LIMIT} derniers patients des {RECENT_RETENTION_DAYS} derniers jours.</p></div><a className="button small primary" href="#scanner" onClick={newRequest}>Nouvelle demande par QR</a></div>
    {view.status === "loading" && <div className="skeleton" role="status"><span className="sr-only">Chargement des patients récents…</span><i /></div>}
    {view.status === "error" && <p className="notice" role="alert">{view.message}</p>}
    {view.status === "ready" && rows.length === 0 && <p className="empty">Aucun patient reçu ces {RECENT_RETENTION_DAYS} derniers jours.</p>}
    {view.status === "ready" && rows.length >= RECENT_SEARCH_FROM && <ListSearchBar label="Rechercher dans vos patients récents" placeholder="Nom ou prénom…" state={listFilter} onChange={patchFilter} onReset={resetFilter} shown={visible.length} total={rows.length} filtered={listFiltered} />}
    {view.status === "ready" && rows.length > 0 && visible.length === 0 && <p className="empty">Aucun patient récent ne correspond à cette recherche.</p>}
    {visible.length > 0 && <ul className="recent-patients__list">{visible.map((row, index) => {
      const name = recentPatientName(row);
      const until = listedUntil(row.last_accessed_at);
      return <li key={`${row.last_accessed_at}-${index}`} className="recent-patients__item">
        <PersonAvatar name={name} size={40} />
        <div><strong>{name}</strong><p className="muted">Dernier accès : {formatWhen(row.last_accessed_at)}{until ? ` · reste dans cette liste jusqu’au ${formatDay(until)}` : ""}</p></div>
      </li>;
    })}</ul>}
    <p className="muted recent-patients__note">Cette liste ne donne aucun accès au carnet. Un accès terminé ne se rouvre pas : pour revoir un patient, faites une nouvelle demande, qu’il devra autoriser.</p>
  </section>;
}
