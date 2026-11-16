// Héro du 15/11/2026 : texte centré, trois petits carrés dans le titre (deux diaporamas de 4 s et le point de départ de la grande image),
// image du héro qui grossit depuis le carré « votre / contrôle », photos de mains de même taille, appel final remplacé.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const landing = await import("../src/lib/landing-content.ts");
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const publicFile = (path) => new URL(`../public${path}`, import.meta.url);

/** Dimensions d'un WebP (VP8 / VP8L / VP8X), lues dans l'en-tête : pas de dépendance d'image. */
function webpSize(buffer) {
  assert.equal(buffer.toString("ascii", 0, 4), "RIFF");
  assert.equal(buffer.toString("ascii", 8, 12), "WEBP");
  const kind = buffer.toString("ascii", 12, 16);
  if (kind === "VP8 ") return [buffer.readUInt16LE(26) & 0x3fff, buffer.readUInt16LE(28) & 0x3fff];
  if (kind === "VP8L") { const bits = buffer.readUInt32LE(21); return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1]; }
  if (kind === "VP8X") return [buffer.readUIntLE(24, 3) + 1, buffer.readUIntLE(27, 3) + 1];
  throw new Error(`format WebP inconnu : ${kind}`);
}
const sizeOf = (path) => webpSize(readFileSync(publicFile(path)));

test("le titre du héro est le slogan « Gardez le fil avec Mon E‑Carnet. », et quatre carrés-diaporama entourent le filigrane", async () => {
  const { APP_SLOGAN } = await import("../src/lib/brand.ts");
  assert.equal(landing.HERO_TITLE_GROUPS.flat().join(" "), landing.HERO.title);
  assert.equal(landing.HERO.title, APP_SLOGAN);
  assert.deepEqual([...landing.HERO_SLOTS], ["a", "b", "c", "d"]);
  assert.ok(landing.HERO_SLIDES.length >= 10, "dix photos au moins pour les diaporamas");
  const tiles = read("src/components/landing/HeroTiles.tsx");
  assert.match(tiles, /data-hero-slot="media"/);
  assert.match(tiles, /MON <\/span>|<span>MON<\/span>/);
});

test("deux diaporamas de 4 s, décalés, au hasard, jamais la même photo dans les deux carrés, immobiles si on réduit les animations", () => {
  assert.equal(landing.HERO_SLIDE_INTERVAL_MS, 4000);
  assert.equal(landing.HERO_SLIDES.length, 5);
  assert.equal(new Set(landing.HERO_SLIDES).size, 5);
  for (const src of landing.HERO_SLIDES) assert.ok(existsSync(publicFile(src)), src);
  const title = read("src/components/landing/HeroTitle.tsx");
  assert.match(title, /HERO_SLIDE_INTERVAL_MS \/ 2/, "un tick toutes les 2 s, un carré sur deux : chaque carré change toutes les 4 s");
  assert.match(title, /turn\+\+ % 2 === 0 \? "a" : "b"/);
  assert.match(title, /Math\.random\(\)/);
  assert.match(title, /pickFrom\(\[now\.a\.cur, now\.b\.cur, now\[which\]\.prev\]\)/, "jamais la même photo dans les deux carrés ni deux fois de suite");
  assert.match(title, /prefers-reduced-motion: reduce/);
  assert.match(title, /document\.hidden/, "pas de défilement quand l'onglet est caché");
  assert.match(title, /aria-hidden="true"/);
  assert.match(title, /alt=""/, "carrés décoratifs");
  assert.match(title, /<h1 id="hero-title"/);
  assert.match(title, /clearInterval/);
});

test("les photos des carrés sont des carrés de 480 × 480", () => {
  for (const src of landing.HERO_SLIDES) assert.deepEqual(sizeOf(src), [480, 480], src);
});

test("le héro : filigrane au centre, slogan et bouton en bas, et la grande image sans animation n'apparaît pas", () => {
  const css = read("src/app/landing-showcase.css");
  assert.match(css, /\.lp-hero__copy \{ position: absolute; inset: 0; z-index: 2; \}/);
  assert.match(css, /\.lp-hero__foot \{ position: absolute;[^}]*justify-items: center;[^}]*text-align: center/);
  assert.match(css, /\.lp-hero__mark \{[^}]*font-weight: 850; letter-spacing: -\.07em;/, "même style que le filigrane du pied de page");
  assert.match(css, /\.lp-hero \.actions \{ justify-content: center; \}/);
  assert.match(css, /\.lp-hero__tg \{ white-space: nowrap; \}/);
  assert.match(css, /\.lp-hero__slot--media \{ display: none;/);
  assert.match(css, /\.lp-root\[data-motion="ready"\] \.lp-hero__slot--media \{ display: block; \}/);
  assert.match(css, /\.lp-root:not\(\[data-motion="ready"\]\) \.lp-hero__media \{ display: none; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{\s*\.lp-hero__slide\[data-pos="in"\], \.lp-hero__slide\[data-pos="out"\] \{ transition: transform/);
});

test("l'image du héro démarre dans le carré du titre (position mesurée, clip-path carré arrondi) et grossit jusqu'au plein cadre", () => {
  const motion = read("src/components/motion/LandingMotion.tsx");
  assert.match(motion, /q\('\[data-hero-slot="media"\]'\)\[0\]/);
  assert.match(motion, /offsetWithin\(slot as HTMLElement, hero as HTMLElement\)/);
  assert.match(motion, /clipPath: `inset\(\$\{insetY\}px \$\{insetX\}px \$\{insetY\}px \$\{insetX\}px round/);
  assert.match(motion, /scale: \(\) => startState\(\)\.scale, x: \(\) => startState\(\)\.x, y: \(\) => startState\(\)\.y, clipPath: \(\) => startState\(\)\.clipPath/);
  assert.match(motion, /clipPath: "inset\(0px 0px 0px 0px round 0px\)"/);
  assert.match(motion, /invalidateOnRefresh: true/, "recalcul au redimensionnement et quand les polices arrivent");
  assert.match(motion, /transformOrigin: "50% 50%"/);
  // Le titre n'est plus découpé par SplitText (le DOM des diaporamas React doit rester intact) ; les titres de section le sont encore.
  assert.doesNotMatch(motion, /SplitText\.create\(title/);
  assert.match(motion, /SplitText\.create\(heading/);
  assert.match(motion, /gsap\.set\(titleWords, \{ yPercent: 125 \}\)/);
});

test("les cinq photos de mains ont la même taille, et le téléphone y occupe la même place", () => {
  const names = ["accueil", "carnet", "motif", "preconsultation", "qr"].map((name) => `/landing/hand-${name}.webp`);
  const sizes = names.map(sizeOf);
  for (const size of sizes) assert.deepEqual(size, sizes[0], "même largeur et même hauteur");
});

test("l'appel final utilise la photo carrée de l'homme qui tient son téléphone, et le héro les nouvelles photos", () => {
  assert.deepEqual(sizeOf(landing.FINAL_IMAGE.src), [landing.FINAL_IMAGE.width, landing.FINAL_IMAGE.height]);
  assert.deepEqual(sizeOf(landing.FINAL_IMAGE.src), [1254, 1254]);
  assert.deepEqual(sizeOf(landing.HERO_IMAGE.desktopSrc), [1672, 941]);
  assert.deepEqual(sizeOf(landing.HERO_IMAGE.mobileSrc), [941, 1672]);
});
