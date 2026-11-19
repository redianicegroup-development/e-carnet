"use client";

import { useEffect, useState } from "react";
import { RecentPatientHistory, recentPatientProfile } from "./ProfessionalPatientDetail";
import { Profile, ProfileGrid } from "./ui/Profile";
import { ApiError, apiGet } from "../infrastructure/api/client";
import { ListSearchBar } from "./list/ListSearchBar";
import { useListFilter } from "./list/useListFilter";
import { RECENT_LIMIT, RECENT_PATIENTS_PATH, RECENT_RETENTION_DAYS, RECENT_SEARCH_FROM, parseRecentPatients, type RecentPatient } from "../lib/recent-patients";
import { matchesQuery } from "../lib/list-filter";
import "./recent-patients.css";

/* PRO-15 — « Patients reçus récemment » : mémoire de travail du professionnel, sans dossier.
   Chaque patient = sa photo ronde et son prénom ; la date du dernier accès est dans la fiche qui s'ouvre au toucher (composant « Profil »). Aucun identifiant, aucun état, aucune donnée médicale n'est affiché ni conservé.
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
    {visible.length > 0 && <ProfileGrid label="Patients reçus récemment">{visible.map((row, index) => {
      const profile = recentPatientProfile(row);
      return <Profile key={`${row.last_accessed_at}-${index}`} {...profile}><RecentPatientHistory name={profile.name} /></Profile>;
    })}</ProfileGrid>}
    <p className="muted recent-patients__note">Cette liste ne donne aucun accès au carnet. Un accès terminé ne se rouvre pas : pour revoir un patient, faites une nouvelle demande, qu’il devra autoriser.</p>
  </section>;
}
