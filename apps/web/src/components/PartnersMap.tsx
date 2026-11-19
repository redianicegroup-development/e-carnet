"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { COTE_D_IVOIRE_BOUNDS, OSM_ATTRIBUTION, OSM_TILE_TEMPLATE, initialsOf, safeLogoUrl, type LatLng } from "../lib/geo";
import "./partners-map.css";

/* Carte des établissements partenaires (Leaflet + OpenStreetMap). Chaque pointeur porte le LOGO de l'établissement, ou ses initiales
   quand il n'en a pas (ou que l'image ne charge pas).

   - Leaflet est importé à l'exécution, dans l'effet (jamais au chargement du module) : il touche à `window` et ferait échouer le rendu
     côté serveur ; et son code n'est téléchargé que lorsque la personne ouvre cet onglet.
   - Mapbox plus tard : le fond de carte vient de `OSM_TILE_TEMPLATE` (lib/geo.ts) ; ce composant garde la même interface.
   - Les pointeurs sont construits avec le DOM (textContent, img.src), jamais avec du HTML assemblé en texte : un nom d'établissement ne peut pas injecter de balise.
   - La liste sous la carte donne les mêmes informations : la carte est un confort, pas le seul moyen d'accès. */
export type MapEstablishment = { key: string; name: string; logo: string; latitude: number; longitude: number };

type Props = {
  items: MapEstablishment[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  /** Position de la personne (Autour de moi), gardée en mémoire de l'écran : elle ne part jamais au serveur. */
  userPosition: LatLng | null;
};

type LeafletModule = typeof Leaflet;

/** Nombre d'établissements les plus proches cadrés avec la personne quand sa position est connue (cadrer tout le pays n'aurait aucun sens). */
const NEAREST_TO_FRAME = 5;

function markerIcon(L: LeafletModule, item: MapEstablishment) {
  const root = document.createElement("div");
  root.className = "partners-marker";
  const badge = document.createElement("span");
  badge.className = "partners-marker__badge";
  const showInitials = () => {
    badge.replaceChildren();
    badge.classList.add("is-initials");
    badge.textContent = initialsOf(item.name);
  };
  const logo = safeLogoUrl(item.logo);
  if (logo) {
    const image = document.createElement("img");
    image.alt = "";
    image.width = 36;
    image.height = 36;
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.onerror = showInitials;
    image.src = logo;
    badge.appendChild(image);
  } else {
    showInitials();
  }
  root.appendChild(badge);
  return L.divIcon({ html: root, className: "partners-marker-icon", iconSize: [44, 54], iconAnchor: [22, 54] });
}

export function PartnersMap({ items, selectedKey, onSelect, userPosition }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const markersRef = useRef<Map<string, Leaflet.Marker>>(new Map());
  const meRef = useRef<Leaflet.Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  // Création de la carte, une seule fois.
  useEffect(() => {
    let cancelled = false;
    let map: Leaflet.Map | null = null;
    let observer: ResizeObserver | null = null;
    const markers = markersRef.current;
    import("leaflet")
      .then((loaded) => {
        const container = containerRef.current;
        if (cancelled || !container) return;
        const L = ((loaded as unknown as { default?: LeafletModule }).default ?? loaded) as LeafletModule;
        leafletRef.current = L;
        map = L.map(container, { minZoom: 5, maxZoom: 18, scrollWheelZoom: false, zoomSnap: 0.5 });
        L.tileLayer(OSM_TILE_TEMPLATE, { attribution: OSM_ATTRIBUTION, maxZoom: 19 }).addTo(map);
        const { latMin, latMax, lngMin, lngMax } = COTE_D_IVOIRE_BOUNDS;
        map.fitBounds([[latMin, lngMin], [latMax, lngMax]]);
        layerRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;
        // La fenêtre peut changer de taille après coup (animation d'ouverture du modal, rotation du téléphone) : Leaflet doit le savoir.
        if (typeof ResizeObserver !== "undefined") {
          observer = new ResizeObserver(() => map?.invalidateSize());
          observer.observe(container);
        }
        setReady(true);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      observer?.disconnect();
      map?.remove();
      mapRef.current = layerRef.current = leafletRef.current = meRef.current = null;
      markers.clear();
      setReady(false);
    };
  }, []);

  // Pointeurs : reconstruits quand la liste change.
  useEffect(() => {
    const L = leafletRef.current;
    const layer = layerRef.current;
    if (!ready || !L || !layer) return;
    layer.clearLayers();
    markersRef.current.clear();
    for (const item of items) {
      const marker = L.marker([item.latitude, item.longitude], { icon: markerIcon(L, item), title: item.name, alt: item.name, keyboard: true, riseOnHover: true });
      marker.on("click", () => onSelectRef.current(item.key));
      marker.addTo(layer);
      markersRef.current.set(item.key, marker);
    }
  }, [ready, items]);

  // Pointeur sélectionné : mis en avant, au-dessus des autres.
  useEffect(() => {
    if (!ready) return;
    markersRef.current.forEach((marker, key) => {
      marker.getElement()?.classList.toggle("is-selected", key === selectedKey);
      marker.setZIndexOffset(key === selectedKey ? 1000 : 0);
    });
  }, [ready, items, selectedKey]);

  // Cadrage : tous les résultats, ou la personne et les plus proches quand elle s'est localisée.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const focus = userPosition ? items.slice(0, NEAREST_TO_FRAME) : items;
    const points: [number, number][] = focus.map((item) => [item.latitude, item.longitude]);
    if (userPosition) points.push([userPosition.latitude, userPosition.longitude]);
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0], 15);
    else map.fitBounds(points, { padding: [36, 36], maxZoom: 16 });
  }, [ready, items, userPosition]);

  // Sélection depuis la liste : la carte s'y rend seulement si le pointeur n'est pas déjà visible.
  useEffect(() => {
    const map = mapRef.current;
    const marker = selectedKey ? markersRef.current.get(selectedKey) : undefined;
    if (!ready || !map || !marker) return;
    const target = marker.getLatLng();
    if (!map.getBounds().contains(target)) map.flyTo(target, Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [ready, selectedKey]);

  // « Vous êtes ici ».
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    meRef.current?.remove();
    meRef.current = null;
    if (!userPosition) return;
    const dot = document.createElement("span");
    dot.className = "partners-me";
    meRef.current = L.marker([userPosition.latitude, userPosition.longitude], {
      icon: L.divIcon({ html: dot, className: "partners-me-icon", iconSize: [22, 22], iconAnchor: [11, 11] }),
      title: "Votre position",
      alt: "Votre position",
      keyboard: false,
      interactive: false,
    }).addTo(map);
  }, [ready, userPosition]);

  if (failed) return <p className="notice" role="status">La carte n’a pas pu se charger. La liste ci-dessous reste disponible.</p>;
  return <div ref={containerRef} className="partners-map" role="region" aria-label="Carte des établissements. La liste sous la carte donne les mêmes informations." />;
}
