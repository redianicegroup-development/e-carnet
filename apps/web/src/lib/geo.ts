/* « Établissements partenaires » : calculs faits SUR L'APPAREIL.
   La position d'une personne n'est jamais envoyée au serveur : l'API renvoie la liste des partenaires visibles, et c'est ici que les
   distances sont calculées et la liste triée. Rien de ce fichier ne touche au réseau ni au stockage. */

export type LatLng = { latitude: number; longitude: number };

/** Ce que l'API renvoie pour chaque partenaire (voir `location.directory_item` côté serveur). */
export type DirectoryEstablishment = {
  name: string;
  establishment_type: string;
  city: string;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
  /** Adresse publique (https) du logo, ou « » : la carte affiche alors les initiales. */
  logo: string;
};

/** Rectangle englobant la Côte d'Ivoire. DOIT rester identique à `COTE_D_IVOIRE_BOUNDS` dans `apps/api/apps/establishments/geo.py` : le serveur reste juge, ceci ne sert qu'à prévenir plus tôt. */
export const COTE_D_IVOIRE_BOUNDS = { latMin: 4.2, latMax: 10.9, lngMin: -8.7, lngMax: -2.4 };
/** Centre de départ de la carte quand la structure n'a pas encore de position (Abidjan). */
export const DEFAULT_MAP_CENTER: LatLng = { latitude: 5.3599, longitude: -4.0083 };

/* Fond de carte : UN seul endroit à changer pour passer de OpenStreetMap à Mapbox (ou MapTiler, Stadia…).
   Leaflet lit ce gabarit tel quel ; Mapbox demandera en plus un jeton public (variable d'environnement NEXT_PUBLIC_…). */
export const OSM_TILE_TEMPLATE = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function isValidPosition(position: Partial<LatLng> | null | undefined): position is LatLng {
  return !!position && isFiniteNumber(position.latitude) && isFiniteNumber(position.longitude) && Math.abs(position.latitude) <= 90 && Math.abs(position.longitude) <= 180;
}

export function isInCoteDIvoire(position: LatLng): boolean {
  const { latMin, latMax, lngMin, lngMax } = COTE_D_IVOIRE_BOUNDS;
  return position.latitude >= latMin && position.latitude <= latMax && position.longitude >= lngMin && position.longitude <= lngMax;
}

/* ---------- distance ---------- */
const EARTH_RADIUS_KM = 6371.0088;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Distance « à vol d'oiseau » en kilomètres (formule de haversine). */
export function haversineKm(from: LatLng, to: LatLng): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km < 0) return "";
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  if (km < 10) return `${km.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(km)} km`;
}

export type WithDistance<T> = T & { distanceKm: number };

/** Copie triée du plus proche au plus lointain, avec la distance de chacun. */
export function sortByDistance<T extends LatLng>(items: T[], from: LatLng): WithDistance<T>[] {
  return items.map((item) => ({ ...item, distanceKm: haversineKm(from, item) })).sort((a, b) => a.distanceKm - b.distanceKm);
}

/* ---------- liens ---------- */
/** Itinéraire vers la structure. Seule la destination est transmise au service de cartes : la position de départ reste celle que l'application de cartes connaît déjà. */
export function directionsUrl(target: LatLng, provider: "google" | "osm" = "google"): string {
  const lat = target.latitude.toFixed(6);
  const lng = target.longitude.toFixed(6);
  return provider === "osm"
    ? `https://www.openstreetmap.org/directions?to=${lat}%2C${lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat}%2C${lng}&travelmode=driving`;
}

/** `tel:` n'accepte que « + » et des chiffres : on retire espaces, points et parenthèses de la saisie libre. */
export function telHref(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  return cleaned ? `tel:${cleaned}` : "";
}

/* ---------- recherche tolérante ---------- */
/** Minuscules, sans accents ni ponctuation : « Hôpital Général d’Abobo » → « hopital general d abobo ». */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/* Mots que les gens emploient l'un pour l'autre : taper « CHU » doit trouver un hôpital, « labo » un laboratoire. */
const SYNONYM_GROUPS = [
  ["hopital", "hopitaux", "chu", "chr", "chg", "hg", "centre hospitalier"],
  ["clinique", "polyclinique", "clinic"],
  ["pharmacie", "pharma"],
  ["laboratoire", "labo", "analyses"],
  ["cabinet", "consultation"],
  ["centre de sante", "dispensaire", "csu", "csr", "pmi", "infirmerie"],
];

function variantsOf(token: string): string[] {
  const group = SYNONYM_GROUPS.find((words) => words.some((word) => word === token));
  return group ? [token, ...group.filter((word) => word !== token)] : [token];
}

/** Distance d'édition bornée : renvoie `limit + 1` dès qu'on sait que le seuil est dépassé. */
function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMinimum = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      rowMinimum = Math.min(rowMinimum, current[j]);
    }
    if (rowMinimum > limit) return limit + 1;
    previous = current;
  }
  return previous[b.length];
}

type Field = { text: string; weight: number };

/** Points gagnés par un mot de la requête sur un champ ; 0 = aucune correspondance. */
function scoreToken(token: string, fields: Field[]): number {
  let best = 0;
  for (const { text, weight } of fields) {
    if (!text) continue;
    const words = text.split(" ");
    for (const variant of variantsOf(token)) {
      if (words.some((word) => word.startsWith(variant))) best = Math.max(best, weight * 3);
      else if (variant.length >= 3 && text.includes(variant)) best = Math.max(best, weight * 2);
    }
    // Faute de frappe : un mot à une lettre près (deux à partir de huit lettres), comparé au début du mot pour tolérer une saisie inachevée.
    if (token.length >= 4) {
      const limit = token.length >= 8 ? 2 : 1;
      if (words.some((word) => editDistance(token, word.slice(0, token.length), limit) <= limit || editDistance(token, word, limit) <= limit)) best = Math.max(best, weight);
    }
  }
  return best;
}

/** Garde les structures qui correspondent à TOUS les mots de la requête (nom, type, ville, adresse), les mieux classées d'abord. Requête vide : liste inchangée. */
export function searchEstablishments<T extends DirectoryEstablishment>(items: T[], query: string): T[] {
  const tokens = normalizeText(query).split(" ").filter(Boolean);
  if (!tokens.length) return items;
  const scored: { item: T; score: number; index: number }[] = [];
  items.forEach((item, index) => {
    const fields: Field[] = [
      { text: normalizeText(item.name), weight: 5 },
      { text: normalizeText(item.establishment_type), weight: 3 },
      { text: normalizeText(item.city), weight: 3 },
      { text: normalizeText(item.address), weight: 1 },
    ];
    let total = 0;
    for (const token of tokens) {
      const score = scoreToken(token, fields);
      if (!score) return;
      total += score;
    }
    scored.push({ item, score: total, index });
  });
  return scored.sort((a, b) => b.score - a.score || a.index - b.index).map((entry) => entry.item);
}

/** Villes présentes dans la liste, triées, pour le choix manuel quand la personne refuse le GPS. */
export function citiesOf(items: DirectoryEstablishment[]): string[] {
  const seen = new Map<string, string>();
  for (const item of items) {
    const key = normalizeText(item.city);
    if (key && !seen.has(key)) seen.set(key, item.city.trim());
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "fr"));
}

export function inCity<T extends DirectoryEstablishment>(items: T[], city: string): T[] {
  const wanted = normalizeText(city);
  return wanted ? items.filter((item) => normalizeText(item.city) === wanted) : items;
}

/* ---------- marqueurs de la carte ---------- */
/** Identifiant de liste et de carte : l'API ne donne volontairement aucun identifiant interne. */
export const establishmentKey = (item: Pick<DirectoryEstablishment, "name" | "latitude" | "longitude">) => `${item.name}|${item.latitude}|${item.longitude}`;

/** Initiales (2 lettres max) quand il n'y a pas de logo : « Hôpital Général d’Abobo » → « HG ». Les mots de liaison sont ignorés. */
export function initialsOf(name: string): string {
  const words = normalizeText(name).split(" ").filter((word) => word.length > 1 && !["de", "du", "des", "la", "le", "les", "et", "d", "l"].includes(word));
  const letters = (words.length ? words : normalizeText(name).split(" ").filter(Boolean)).slice(0, 2).map((word) => word[0]).join("");
  return (letters || "?").toUpperCase();
}

/** Un logo n'est affiché que s'il vient d'une adresse https : jamais de `javascript:`, de `data:` ni de route interne. */
export function safeLogoUrl(value: string | null | undefined): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

/* ---------- carte (projection Web Mercator, tuiles de 256 px) ---------- */
export const TILE_SIZE = 256;
export const MIN_ZOOM = 5;
export const MAX_ZOOM = 18;
const MAX_MERCATOR_LATITUDE = 85.0511287798;

export const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom)));

/** Coordonnées en pixels sur la carte du monde au zoom donné. */
export function projectToWorld(position: LatLng, zoom: number): { x: number; y: number } {
  const scale = TILE_SIZE * 2 ** zoom;
  const latitude = Math.max(-MAX_MERCATOR_LATITUDE, Math.min(MAX_MERCATOR_LATITUDE, position.latitude));
  const sine = Math.sin(toRadians(latitude));
  return {
    x: ((position.longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * scale,
  };
}

/** Opération inverse de `projectToWorld`. */
export function unprojectFromWorld(point: { x: number; y: number }, zoom: number): LatLng {
  const scale = TILE_SIZE * 2 ** zoom;
  const longitude = (point.x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * point.y) / scale;
  const latitude = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { latitude, longitude };
}

/** Adresse d'une tuile OpenStreetMap ; la longitude est ramenée dans [0, 2^zoom[ pour une carte qui se répète. */
export function tileUrl(x: number, y: number, zoom: number): string {
  const count = 2 ** zoom;
  const wrappedX = ((x % count) + count) % count;
  return `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`;
}
