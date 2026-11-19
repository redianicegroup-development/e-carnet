"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { MAX_ZOOM, MIN_ZOOM, TILE_SIZE, clampZoom, projectToWorld, tileUrl, unprojectFromWorld, type LatLng } from "../lib/geo";
import "./location-picker.css";

/* Carte pour poser l'épingle d'une structure.
   Choix de conception : pas de bibliothèque de cartes (Leaflet…). L'application vise les connexions lentes et cette carte ne sert qu'à
   l'administrateur d'un établissement, une fois ; une centaine de lignes suffisent et le lot de dépendances ne change pas.
   Principe « épingle au centre » : l'épingle est fixe au milieu, on déplace la carte dessous (glisser, flèches du clavier, boutons +/−).
   La position choisie est donc toujours celle du centre : pas de glisser-déposer d'une petite épingle au doigt. */
type Props = {
  /** Position courante de l'épingle (centre de la carte). */
  value: LatLng;
  onChange: (position: LatLng) => void;
  /** Zoom de départ : large tant que la structure n'a pas de position, serré sur le bâtiment sinon. */
  initialZoom?: number;
  disabled?: boolean;
};

const KEYBOARD_STEP_PX = 48;

export function LocationPicker({ value, onChange, initialZoom = 16, disabled = false }: Props) {
  const [zoom, setZoom] = useState(() => clampZoom(initialZoom));
  const [size, setSize] = useState({ width: 320, height: 280 });
  const [tilesFailed, setTilesFailed] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; startX: number; startY: number; worldX: number; worldY: number } | null>(null);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const world = projectToWorld(value, zoom);
  const moveTo = useCallback((x: number, y: number, atZoom: number) => {
    const limit = TILE_SIZE * 2 ** atZoom;
    onChange(unprojectFromWorld({ x: Math.min(limit, Math.max(0, x)), y: Math.min(limit, Math.max(0, y)) }, atZoom));
  }, [onChange]);

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, worldX: world.x, worldY: world.y };
  }
  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    moveTo(current.worldX - (event.clientX - current.startX), current.worldY - (event.clientY - current.startY), zoom);
  }
  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  }
  function changeZoom(next: number) {
    setZoom(clampZoom(next)); // le centre reste le même : seule l'échelle change
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-KEYBOARD_STEP_PX, 0], ArrowRight: [KEYBOARD_STEP_PX, 0], ArrowUp: [0, -KEYBOARD_STEP_PX], ArrowDown: [0, KEYBOARD_STEP_PX] };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      moveTo(world.x + move[0], world.y + move[1], zoom);
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      changeZoom(zoom + 1);
    } else if (event.key === "-") {
      event.preventDefault();
      changeZoom(zoom - 1);
    }
  }

  // Tuiles qui couvrent la fenêtre ; chacune est placée par rapport au coin haut-gauche de la fenêtre.
  const originX = world.x - size.width / 2;
  const originY = world.y - size.height / 2;
  const tiles: { key: string; x: number; y: number; left: number; top: number }[] = [];
  const tileCount = 2 ** zoom;
  for (let tileX = Math.floor(originX / TILE_SIZE); tileX <= Math.floor((originX + size.width) / TILE_SIZE); tileX += 1) {
    for (let tileY = Math.max(0, Math.floor(originY / TILE_SIZE)); tileY <= Math.min(tileCount - 1, Math.floor((originY + size.height) / TILE_SIZE)); tileY += 1) {
      tiles.push({ key: `${zoom}/${tileX}/${tileY}`, x: tileX, y: tileY, left: tileX * TILE_SIZE - originX, top: tileY * TILE_SIZE - originY });
    }
  }

  return (
    <div className="location-picker">
      <div
        ref={viewportRef}
        className="location-picker__viewport"
        role="group"
        tabIndex={disabled ? -1 : 0}
        aria-label="Carte pour placer l’épingle de votre établissement. Flèches du clavier : déplacer la carte. Plus et moins : zoom."
        aria-disabled={disabled || undefined}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        {tiles.map((tile) => (
          // eslint-disable-next-line @next/next/no-img-element -- tuiles de carte tierces : next/image n'apporte rien ici
          <img key={tile.key} className="location-picker__tile" src={tileUrl(tile.x, tile.y, zoom)} alt="" width={TILE_SIZE} height={TILE_SIZE} draggable={false} loading="lazy" decoding="async" referrerPolicy="strict-origin-when-cross-origin" style={{ left: tile.left, top: tile.top }} onError={() => setTilesFailed(true)} onLoad={() => setTilesFailed(false)} />
        ))}
        <svg className="location-picker__pin" viewBox="0 0 24 32" width="34" height="46" aria-hidden="true" focusable="false">
          <path d="M12 31s10-9.2 10-18A10 10 0 0 0 2 13c0 8.8 10 18 10 18z" fill="var(--danger, #A32D2D)" stroke="#fff" strokeWidth="1.5" />
          <circle cx="12" cy="13" r="4" fill="#fff" />
        </svg>
        <div className="location-picker__zoom">
          <button type="button" aria-label="Zoom avant" onClick={() => changeZoom(zoom + 1)} disabled={disabled || zoom >= MAX_ZOOM}>+</button>
          <button type="button" aria-label="Zoom arrière" onClick={() => changeZoom(zoom - 1)} disabled={disabled || zoom <= MIN_ZOOM}>−</button>
        </div>
        <a className="location-picker__credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a>
      </div>
      {tilesFailed && <p className="notice" role="status">La carte ne se charge pas (connexion lente ?). Vous pouvez saisir les coordonnées à la main ci-dessous.</p>}
    </div>
  );
}
