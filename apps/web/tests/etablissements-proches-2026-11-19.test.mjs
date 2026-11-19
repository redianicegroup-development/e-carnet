// Établissements proches : calculs faits sur l'appareil (distance, tri, recherche tolérante, itinéraire, projection de la carte).
// La position d'une personne ne quitte jamais son téléphone : ces tests portent sur les fonctions pures de lib/geo.ts.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const geo = await import("../src/lib/geo.ts");
const root = new URL("../", import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), "utf8");
const code = (rel) => read(rel).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const COCODY = { latitude: 5.3599, longitude: -4.0083 };
const PLATEAU = { latitude: 5.3236, longitude: -4.0196 };
const item = (name, establishment_type, city, address, latitude, longitude, phone = "+225 07 00 00 00 00") => ({ name, establishment_type, city, address, phone, latitude, longitude });
const LIST = [
  item("Clinique des Jardins", "Clinique", "Abidjan", "Rue des Jardins, Cocody", 5.3599, -4.0083),
  item("Hôpital Général d’Abobo", "Hôpital", "Abidjan", "Abobo Baoulé", 5.4235, -4.0204),
  item("Centre de Santé Urbain de Korhogo", "Centre de santé", "Korhogo", "Quartier Soba", 9.4580, -5.6296),
  item("Pharmacie du Plateau", "Pharmacie", "Abidjan", "Avenue Franchet d’Esperey", 5.3236, -4.0196),
  item("CHU de Bouaké", "Hôpital", "Bouaké", "Commerce", 7.6906, -5.0303),
];
const names = (items) => items.map((entry) => entry.name);

/* ---------- distance ---------- */
test("un degré de latitude fait environ 111 km", () => {
  const km = geo.haversineKm({ latitude: 5, longitude: -4 }, { latitude: 6, longitude: -4 });
  assert.ok(km > 110.9 && km < 111.4, String(km));
});

test("Plateau → Cocody : environ 4 km à vol d'oiseau, et la distance est symétrique", () => {
  const km = geo.haversineKm(PLATEAU, COCODY);
  assert.ok(km > 4.0 && km < 4.6, String(km));
  assert.equal(geo.haversineKm(PLATEAU, COCODY).toFixed(9), geo.haversineKm(COCODY, PLATEAU).toFixed(9));
  assert.equal(geo.haversineKm(COCODY, COCODY), 0);
});

test("les distances s'affichent à la française, arrondies à ce qu'un GPS sait vraiment dire", () => {
  assert.equal(geo.formatDistance(0.004), "10 m");
  assert.equal(geo.formatDistance(0.347), "350 m");
  assert.equal(geo.formatDistance(1.25), "1,3 km");
  assert.equal(geo.formatDistance(9.94), "9,9 km");
  assert.equal(geo.formatDistance(12.4), "12 km");
  assert.equal(geo.formatDistance(Number.NaN), "");
});

test("la liste est triée du plus proche au plus lointain, sans modifier l'originale", () => {
  const original = names(LIST);
  const sorted = geo.sortByDistance(LIST, PLATEAU);
  assert.deepEqual(names(sorted).slice(0, 3), ["Pharmacie du Plateau", "Clinique des Jardins", "Hôpital Général d’Abobo"]);
  assert.equal(names(sorted).at(-1), "Centre de Santé Urbain de Korhogo");
  assert.ok(sorted.every((entry, index) => index === 0 || entry.distanceKm >= sorted[index - 1].distanceKm));
  assert.deepEqual(names(LIST), original);
});

/* ---------- recherche intelligente ---------- */
test("la recherche ignore accents, majuscules et ponctuation", () => {
  assert.deepEqual(names(geo.searchEstablishments(LIST, "hopital general abobo")), ["Hôpital Général d’Abobo"]);
  assert.deepEqual(names(geo.searchEstablishments(LIST, "  PLATEAU ")), ["Pharmacie du Plateau"]);
});

test("tous les mots doivent correspondre, dans n'importe quel champ (nom, type, ville, adresse)", () => {
  assert.deepEqual(names(geo.searchEstablishments(LIST, "hopital abidjan")), ["Hôpital Général d’Abobo"]);
  assert.deepEqual(names(geo.searchEstablishments(LIST, "soba korhogo")), ["Centre de Santé Urbain de Korhogo"]);
  assert.deepEqual(geo.searchEstablishments(LIST, "hopital korhogo"), []);
});

test("une faute de frappe à une lettre près est pardonnée, une saisie inachevée aussi", () => {
  assert.deepEqual(names(geo.searchEstablishments(LIST, "clinik jardins")), ["Clinique des Jardins"]);
  assert.deepEqual(names(geo.searchEstablishments(LIST, "pharmasie")), ["Pharmacie du Plateau"]);
  assert.deepEqual(names(geo.searchEstablishments(LIST, "korho")), ["Centre de Santé Urbain de Korhogo"]);
  assert.deepEqual(geo.searchEstablishments(LIST, "xyzxyz"), []);
});

test("les mots courants valent leurs équivalents : CHU et hôpital se retrouvent", () => {
  assert.deepEqual(names(geo.searchEstablishments(LIST, "chu")).sort(), ["CHU de Bouaké", "Hôpital Général d’Abobo"]);
  assert.deepEqual(names(geo.searchEstablishments(LIST, "dispensaire")), ["Centre de Santé Urbain de Korhogo"]);
});

test("le nom compte plus que l'adresse, et une requête vide rend la liste telle quelle", () => {
  const results = geo.searchEstablishments([item("Rue Abobo", "Autre", "X", "", 5, -4), item("Abobo Clinic", "Clinique", "X", "", 5, -4)], "abobo");
  assert.equal(results.length, 2);
  assert.equal(geo.searchEstablishments(LIST, "   "), LIST);
});

test("les villes proposées sont uniques et triées, et le filtre par ville ignore les accents", () => {
  assert.deepEqual(geo.citiesOf(LIST), ["Abidjan", "Bouaké", "Korhogo"]);
  assert.deepEqual(names(geo.inCity(LIST, "bouake")), ["CHU de Bouaké"]);
  assert.equal(geo.inCity(LIST, ""), LIST);
});

/* ---------- liens ---------- */
test("l'itinéraire ne transmet que la destination", () => {
  const google = geo.directionsUrl(COCODY);
  assert.equal(google, "https://www.google.com/maps/dir/?api=1&destination=5.359900%2C-4.008300&travelmode=driving");
  assert.equal(geo.directionsUrl(COCODY, "osm"), "https://www.openstreetmap.org/directions?to=5.359900%2C-4.008300");
});

test("le lien téléphone ne garde que le + et les chiffres", () => {
  assert.equal(geo.telHref("+225 07 00-00.00 (00)"), "tel:+2250700000000");
  assert.equal(geo.telHref("   "), "");
  assert.equal(geo.telHref("07+00"), "tel:0700");
});

/* ---------- garde-fous de position ---------- */
test("les positions hors Côte d'Ivoire ou impossibles sont reconnues", () => {
  assert.ok(geo.isInCoteDIvoire(COCODY));
  assert.ok(!geo.isInCoteDIvoire({ latitude: 48.85, longitude: 2.35 }));
  assert.ok(!geo.isInCoteDIvoire({ latitude: -4.0083, longitude: 5.3599 }), "latitude et longitude inversées");
  assert.ok(geo.isValidPosition(COCODY));
  assert.ok(!geo.isValidPosition({ latitude: Number.NaN, longitude: 1 }));
  assert.ok(!geo.isValidPosition({ latitude: 95, longitude: 1 }));
  assert.ok(!geo.isValidPosition(null));
});

/* ---------- carte ---------- */
test("projeter puis déprojeter redonne la même position, à quelques centimètres près", () => {
  for (const zoom of [6, 12, 17]) {
    const back = geo.unprojectFromWorld(geo.projectToWorld(COCODY, zoom), zoom);
    assert.ok(Math.abs(back.latitude - COCODY.latitude) < 1e-7, `zoom ${zoom}`);
    assert.ok(Math.abs(back.longitude - COCODY.longitude) < 1e-7, `zoom ${zoom}`);
  }
});

test("repères de la projection : le méridien 0 est au milieu du monde, la longitude -180 à gauche", () => {
  assert.equal(geo.projectToWorld({ latitude: 0, longitude: 0 }, 0).x, 128);
  assert.equal(geo.projectToWorld({ latitude: 0, longitude: 0 }, 0).y, 128);
  assert.equal(geo.projectToWorld({ latitude: 0, longitude: -180 }, 3).x, 0);
});

test("les tuiles se ramènent dans la carte du monde et le zoom reste borné", () => {
  assert.equal(geo.tileUrl(3, 5, 4), "https://tile.openstreetmap.org/4/3/5.png");
  assert.equal(geo.tileUrl(-1, 5, 4), "https://tile.openstreetmap.org/4/15/5.png");
  assert.equal(geo.tileUrl(17, 5, 4), "https://tile.openstreetmap.org/4/1/5.png");
  assert.equal(geo.clampZoom(99), geo.MAX_ZOOM);
  assert.equal(geo.clampZoom(-3), geo.MIN_ZOOM);
});

/* ---------- confidentialité et branchement (lecture du code, comme les autres tests du dépôt) ---------- */
test("la position de la personne ne part jamais au serveur ni dans le stockage du navigateur", () => {
  const screen = code("src/components/NearbyEstablishments.tsx");
  assert.match(screen, /apiGet<DirectoryResponse>\("\/api\/v1\/establishments\/directory\/"\)/, "requête sans paramètre");
  assert.doesNotMatch(screen, /directory\/\?|[?&]lat|[?&]lng|latitude=|longitude=/, "aucune position dans l'adresse (elle finirait dans les journaux du serveur)");
  assert.doesNotMatch(screen, /localStorage|sessionStorage|indexedDB|document\.cookie|apiPost|apiPatch|apiPut|sendBeacon/, "rien n'est stocké ni envoyé");
  assert.match(screen, /getCurrentPosition/);
  const calls = screen.split("getCurrentPosition").length - 1;
  assert.equal(calls, 1, "la géolocalisation n'est demandée qu'à un seul endroit : le clic sur « Autour de moi »");
  assert.match(screen, /function aroundMe\(\)[\s\S]*getCurrentPosition/);
  assert.doesNotMatch(screen.replace(/function aroundMe[\s\S]*?\n  }\n/, ""), /getCurrentPosition/);
});

test("aucun numéro d'urgence n'est affiché ni codé en dur dans l'onglet", () => {
  const screen = code("src/components/NearbyEstablishments.tsx");
  assert.doesNotMatch(screen, /SAMU|185|urgence/i);
  assert.equal(geo.SAMU_NUMBER, undefined);
});

test("l'onglet « Établissements proches de moi » existe dans les paramètres de chaque espace", () => {
  for (const file of ["AccountSettingsClient", "ProfessionalSettingsClient", "EstablishmentSettingsClient"]) {
    const source = read(`src/components/${file}.tsx`);
    assert.match(source, /id: "etablissements-partenaires", title: "Établissements proches de moi"/, file);
    assert.match(source, /activeSection === "etablissements-partenaires"[\s\S]{0,260}<NearbyEstablishments \/>/, file);
  }
  const laboratory = read("src/app/laboratoire/parametres/page.tsx");
  assert.match(laboratory, /<EstablishmentSettingsClient laboratory \/>/, "l'espace laboratoire réutilise les paramètres établissement, donc la rubrique");
});

test("la position se pose dans la fiche, pas pour un laboratoire, par une requête à part", () => {
  const editor = read("src/components/EstablishmentProfileEditor.tsx");
  assert.match(editor, /\{!lab && <EstablishmentLocationField variant=\{scope === "all" \? "onboarding" : "settings"\} profile=\{profile\}/);
  const field = code("src/components/EstablishmentLocationField.tsx");
  assert.match(field, /apiPatch<EstablishmentProfile>\(`\/api\/v1\/establishments\/\$\{profile\.id\}\/profile\/`/);
  assert.match(field, /isInCoteDIvoire/, "avertit avant même d'envoyer une position hors du pays");
  assert.equal(field.split("getCurrentPosition").length - 1, 1, "le GPS n'est demandé qu'au clic sur le bouton de position");
});

test("onboarding : un bouton « Mettre ma position » relève latitude et longitude, SANS carte ; la carte reste dans les paramètres", () => {
  const field = code("src/components/EstablishmentLocationField.tsx");
  assert.match(field, /"Mettre ma position"/);
  const onboardingBlock = field.slice(field.indexOf("editing && draft && onboarding &&"), field.indexOf("editing && draft && !onboarding &&"));
  assert.ok(onboardingBlock.length > 200, "bloc onboarding trouvé");
  assert.doesNotMatch(onboardingBlock, /LocationPicker/, "aucune carte dans l'onboarding");
  assert.match(onboardingBlock, /Latitude <strong>\{text\.latitude\}<\/strong>/);
  assert.match(onboardingBlock, /Enregistrer cette position/);
  const settingsBlock = field.slice(field.indexOf("editing && draft && !onboarding &&"));
  assert.match(settingsBlock, /<LocationPicker/, "la carte de vérification reste dans les paramètres");
  assert.match(field, /LOW_ACCURACY_METERS/, "avertit quand la précision est faible (ordinateur, Wi‑Fi)");
});

test("la carte des partenaires utilise Leaflet, chargé à l'exécution, avec le logo de chaque établissement en pointeur", () => {
  const map = code("src/components/PartnersMap.tsx");
  assert.match(map, /import\("leaflet"\)/, "importé dans l'effet : Leaflet touche à window et casserait le rendu serveur");
  assert.doesNotMatch(map, /^import (?!type)[^;]*from "leaflet";/m, "aucun import de valeur au chargement du module");
  assert.match(map, /import "leaflet\/dist\/leaflet\.css"/);
  assert.match(map, /safeLogoUrl\(item\.logo\)/);
  assert.match(map, /badge\.textContent = initialsOf/, "initiales posées en texte, pas en HTML");
  assert.doesNotMatch(map, /innerHTML|dangerouslySetInnerHTML/, "un nom d'établissement ne peut pas injecter de balise");
  assert.match(map, /OSM_TILE_TEMPLATE/, "fond de carte isolé en un seul endroit (Mapbox plus tard)");
  const manifest = JSON.parse(read("package.json"));
  assert.match(manifest.dependencies.leaflet, /^\^1\.9\./);
  assert.ok(manifest.devDependencies["@types/leaflet"]);
});

test("la carte de confirmation de l'administrateur n'a pas de dépendance et crédite OpenStreetMap", () => {
  const picker = code("src/components/LocationPicker.tsx");
  assert.doesNotMatch(picker, /leaflet|maplibre|mapbox/i);
  assert.match(picker, /https:\/\/www\.openstreetmap\.org\/copyright/);
});

test("les initiales et les logos : jamais de HTML, jamais autre chose que https", () => {
  assert.equal(geo.initialsOf("Hôpital Général d’Abobo"), "HG");
  assert.equal(geo.initialsOf("Clinique des Jardins"), "CJ");
  assert.equal(geo.initialsOf("—"), "?");
  assert.equal(geo.safeLogoUrl("https://res.cloudinary.com/demo/logo.webp"), "https://res.cloudinary.com/demo/logo.webp");
  for (const unsafe of ["javascript:alert(1)", "data:image/png;base64,AAAA", "/api/v1/establishments/1/logo/", "http://exemple.test/logo.png", "", null, undefined]) {
    assert.equal(geo.safeLogoUrl(unsafe), "", String(unsafe));
  }
  assert.equal(geo.establishmentKey({ name: "A", latitude: 5.1, longitude: -4.2 }), "A|5.1|-4.2");
});
