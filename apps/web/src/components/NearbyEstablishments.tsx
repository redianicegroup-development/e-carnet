"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { apiGet } from "../infrastructure/api/client";
import { citiesOf, directionsUrl, establishmentKey, formatDistance, inCity, initialsOf, safeLogoUrl, searchEstablishments, sortByDistance, telHref, type DirectoryEstablishment, type LatLng } from "../lib/geo";
import { PartnersMap, type MapEstablishment } from "./PartnersMap";
import { Icon } from "./ui/Icon";
import "./nearby-establishments.css";

/* Onglet « Établissements proches de moi » des paramètres (patient, professionnel, établissement, laboratoire) :
   barre de recherche (nom précis ou recherche libre), carte avec le logo de chaque établissement en pointeur, puis la liste.

   Confidentialité : la requête au serveur ne contient AUCUNE position (voir `EstablishmentDirectoryView`). Le serveur renvoie les
   partenaires visibles, et c'est ce composant qui calcule les distances sur l'appareil. La position n'est demandée qu'au clic sur
   « Autour de moi », reste en mémoire de cet écran, et n'est ni envoyée, ni stockée (ni localStorage, ni cookie). */
type DirectoryResponse = { items: DirectoryEstablishment[]; truncated: boolean };
type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; items: DirectoryEstablishment[]; truncated: boolean };
type Locating = { state: "idle" } | { state: "locating" } | { state: "ready"; position: LatLng } | { state: "unavailable"; message: string };
type Row = DirectoryEstablishment & { key: string; distanceKm: number | null };

const PAGE_SIZE = 30;

function geolocationMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) return "Localisation refusée. Choisissez votre ville ci-dessous, ou autorisez la localisation dans les réglages du navigateur.";
  if (error.code === error.TIMEOUT) return "La localisation prend trop de temps. Choisissez votre ville ci-dessous.";
  return "Position indisponible sur cet appareil. Choisissez votre ville ci-dessous.";
}

/** Logo de l'établissement, ou ses initiales s'il n'en a pas (ou si l'image ne charge pas). */
function Logo({ name, logo }: { name: string; logo: string }) {
  const [failed, setFailed] = useState(false);
  const source = safeLogoUrl(logo);
  return (
    <span className="nearby__logo" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- logo tiers (Cloudinary), dimension fixe */}
      {source && !failed ? <img src={source} alt="" width={44} height={44} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : initialsOf(name)}
    </span>
  );
}

function EstablishmentCard({ row, selected = false, onShowOnMap, onClose }: { row: Row; selected?: boolean; onShowOnMap?: () => void; onClose?: () => void }) {
  return (
    <div className={`nearby__item${selected ? " is-selected" : ""}`}>
      <div className="nearby__head">
        <Logo name={row.name} logo={row.logo} />
        <div className="nearby__title">
          <strong>{row.name}</strong>
          <span className="muted">{[row.establishment_type, row.city].filter(Boolean).join(" · ")}</span>
        </div>
        {row.distanceKm !== null && <span className="nearby__distance" title="Distance à vol d’oiseau"><Icon name="pin" size={14} />{formatDistance(row.distanceKm)}</span>}
      </div>
      {row.address && <p>{row.address}</p>}
      <div className="nearby__actions">
        {telHref(row.phone) && <a className="button" href={telHref(row.phone)}><Icon name="phone" size={18} />Appeler</a>}
        <a className="button" href={directionsUrl(row, "google")} target="_blank" rel="noopener noreferrer"><Icon name="pin" size={18} />Itinéraire</a>
        <a className="nearby__osm" href={directionsUrl(row, "osm")} target="_blank" rel="noopener noreferrer">OpenStreetMap</a>
        {onShowOnMap && <button type="button" className="button" onClick={onShowOnMap}>Voir sur la carte</button>}
        {onClose && <button type="button" className="button" onClick={onClose}>Fermer</button>}
      </div>
    </div>
  );
}

export function NearbyEstablishments() {
  const searchId = useId();
  const cityId = useId();
  const mapSectionRef = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [locating, setLocating] = useState<Locating>({ state: "idle" });
  const [shown, setShown] = useState(PAGE_SIZE);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiGet<DirectoryResponse>("/api/v1/establishments/directory/")
      .then((data) => { if (active) setLoad({ status: "ready", items: data.items, truncated: data.truncated }); })
      .catch((reason: unknown) => { if (active) setLoad({ status: "error", message: reason instanceof Error ? reason.message : "Liste indisponible." }); });
    return () => { active = false; };
  }, [attempt]);

  const items = useMemo(() => (load.status === "ready" ? load.items : []), [load]);
  const cities = useMemo(() => citiesOf(items), [items]);
  const position = locating.state === "ready" ? locating.position : null;
  const rows = useMemo<Row[]>(() => {
    const matched = searchEstablishments(inCity(items, city), query);
    if (position) return sortByDistance(matched, position).map((item) => ({ ...item, key: establishmentKey(item) }));
    return matched.map((item) => ({ ...item, key: establishmentKey(item), distanceKm: null }));
  }, [items, city, query, position]);
  const mapItems = useMemo<MapEstablishment[]>(() => rows.map(({ key, name, logo, latitude, longitude }) => ({ key, name, logo, latitude, longitude })), [rows]);
  const selected = selectedKey ? rows.find((row) => row.key === selectedKey) ?? null : null;

  function aroundMe() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLocating({ state: "unavailable", message: "Cet appareil ne sait pas se localiser. Choisissez votre ville ci-dessous." });
      return;
    }
    setLocating({ state: "locating" });
    setShown(PAGE_SIZE);
    // Demandée uniquement ici, au clic ; précision « approximative » suffisante pour classer des établissements, et moins gourmande en batterie.
    navigator.geolocation.getCurrentPosition(
      (result) => { setLocating({ state: "ready", position: { latitude: result.coords.latitude, longitude: result.coords.longitude } }); setCity(""); },
      (failure) => setLocating({ state: "unavailable", message: geolocationMessage(failure) }),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 },
    );
  }
  function showOnMap(key: string) {
    setSelectedKey(key);
    mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="nearby">
      <div className="nearby__controls">
        <label className="field" htmlFor={searchId}>
          <span>Rechercher un établissement</span>
          <input id={searchId} type="search" enterKeyHint="search" autoComplete="off" placeholder="Un nom précis, ou « hôpital Cocody », « pharmacie »…" value={query} onChange={(event) => { setQuery(event.target.value); setShown(PAGE_SIZE); }} />
        </label>
        <div className="nearby__locate">
          <button type="button" className="button primary" onClick={aroundMe} disabled={load.status !== "ready" || locating.state === "locating"}>
            <Icon name="pin" size={18} />{locating.state === "locating" ? "Localisation…" : position ? "Actualiser ma position" : "Autour de moi"}
          </button>
          {position && <button type="button" className="button" onClick={() => setLocating({ state: "idle" })}>Ne plus utiliser ma position</button>}
        </div>
        {!position && cities.length > 1 && (
          <label className="field" htmlFor={cityId}>
            <span>Ma ville</span>
            <select id={cityId} value={city} onChange={(event) => { setCity(event.target.value); setShown(PAGE_SIZE); }}>
              <option value="">Toutes les villes</option>
              {cities.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
        )}
        <p className="muted nearby__privacy">Votre position n’est demandée que lorsque vous touchez « Autour de moi ». Elle reste sur votre appareil : elle n’est ni envoyée à <span className="notranslate" translate="no">Mon E‑Carnet</span> ni enregistrée. Le fond de carte vient d’OpenStreetMap, qui reçoit les parties de carte affichées, par exemple votre quartier.</p>
        {locating.state === "unavailable" && <p className="notice" role="status">{locating.message}</p>}
      </div>

      {load.status === "loading" && <p className="muted" role="status">Chargement des établissements…</p>}
      {load.status === "error" && (
        <div className="nearby__state">
          <p className="notice error" role="alert">{load.message}</p>
          <button type="button" className="button" onClick={() => { setLoad({ status: "loading" }); setAttempt((value) => value + 1); }}>Réessayer</button>
        </div>
      )}

      {load.status === "ready" && (
        <>
          <p className="muted nearby__count" role="status" aria-live="polite">
            {items.length === 0 ? "Aucun établissement partenaire n’est encore visible dans la recherche."
              : rows.length === 0 ? "Aucun établissement ne correspond. Essayez un autre mot ou une autre ville."
                : `${rows.length} établissement${rows.length > 1 ? "s" : ""}${position ? ", du plus proche au plus lointain (distance à vol d’oiseau)" : ""}`}
          </p>
          {load.truncated && <p className="notice" role="status">La liste est très longue : précisez votre recherche pour trouver un établissement.</p>}

          {items.length > 0 && (
            <div className="nearby__map" ref={mapSectionRef}>
              <PartnersMap items={mapItems} selectedKey={selected?.key ?? null} onSelect={setSelectedKey} userPosition={position} />
              {selected && <EstablishmentCard row={selected} selected onClose={() => setSelectedKey(null)} />}
            </div>
          )}

          <ul className="nearby__list">
            {rows.slice(0, shown).map((row) => (
              <li key={row.key} aria-current={row.key === selected?.key ? "true" : undefined}>
                <EstablishmentCard row={row} selected={row.key === selected?.key} onShowOnMap={row.key === selected?.key ? undefined : () => showOnMap(row.key)} />
              </li>
            ))}
          </ul>
          {rows.length > shown && <button type="button" className="button" onClick={() => setShown((value) => value + PAGE_SIZE)}>Afficher plus ({rows.length - shown} restants)</button>}
        </>
      )}
    </div>
  );
}
