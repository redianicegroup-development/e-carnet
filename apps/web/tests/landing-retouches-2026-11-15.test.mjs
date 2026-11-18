// Retouches du 15/11/2026 (3e demande) : modal « Partager en QR » responsive, pastille du héro retirée, carrés du titre agrandis,
// image de la section Solution plafonnée, liens de navigation de l'en-tête centrés.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("le héro n'a plus la pastille « Carnet de santé numérique » (page et contenu)", () => {
  assert.doesNotMatch(read("src/app/page.tsx"), /HERO\.eyebrow|className="eyebrow" data-hero-item/);
  assert.doesNotMatch(read("src/lib/landing-content.ts"), /Carnet de santé numérique/);
});

test("les carrés du titre : même côté en « em » (ils suivent la taille du titre), deux diaporamas inclinés et un carré vide pour la grande image", () => {
  const css = read("src/app/landing-hero.css");
  assert.match(css, /\.lp-hero__slot \{ --t: 1\.14em; position: relative; display: inline-block;/, "carrés agrandis (18/11/2026) : 1,14 em au lieu de 0,98 em");
  assert.match(css, /\.lp-hero__slot--a \{ rotate: -6deg; \}/);
  assert.match(css, /\.lp-hero__slot--b \{ rotate: 5deg; \}/);
  assert.match(css, /\.lp-hero h1 \{[^}]*font-size: clamp\(2rem, min\(8\.4vw, 9\.2svh\), 6\.6rem\)/);
});

test("« Partager en QR » : fenêtre de 680 px sur ordinateur (QR à gauche, détails à droite), empilée dessous de 720 px, jamais coupée", () => {
  const css = read("src/components/access/access-history.css");
  assert.match(css, /@media \(min-width: 720px\) \{\s*\.modal-dialog\.share-qr-dialog \{ width: min\(100%, 680px\)/);
  assert.match(css, /\.share-qr-dialog \.patient-active-qr \{ flex-direction: row/);
  assert.match(css, /\.share-qr-dialog \.patient-active-qr__countdown \{ white-space: nowrap/);
  assert.match(css, /max-height: 700px\) \{[^}]*patient-active-qr__code svg \{ width: 148px/);
  assert.match(read("src/components/modal/modal.css"), /\.modal-dialog \{[^}]*max-height: min\(92dvh, 720px\)[^}]*overflow: auto/, "si l'écran est très bas, la fenêtre défile");
});

test("section Solution : l'image main + téléphone est plafonnée à 440 px et à 64 % de la hauteur d'écran, mobile inchangé", () => {
  const css = read("src/app/landing-v2.css");
  assert.match(css, /\.lp2-solution \.lp2-hand-stack \{width:min\(100%,440px,calc\(64svh \* \.7075 \+ 68px\)\)\}/);
  assert.match(css, /\.lp2-hand-stack, \.lp2-solution \.lp2-hand-stack \{width:min\(86vw,420px\)\}/);
  assert.match(css, /\.lp2-flow-phone \.lp2-hand-stack \{[^}]*width:min\(100%,420px\)/, "les trois étapes gardent leur taille");
});

test("en-tête public : le logo seul, centré et FIXE en haut de l'écran (fond seulement quand la page défile), et un bouton à trois traits fixé en bas", () => {
  const css = read("src/app/site-pages.css");
  const header = read("src/components/public/PublicHeader.tsx");
  assert.match(css, /\.pub-header \{ position: relative; z-index: 20; height: 0; \}/, "pas de barre : le logo flotte sans arrière-plan");
  assert.match(css, /\.pub-header \.brand \{ position: fixed; z-index: 1; top: calc\(var\(--net-banner-h, 0px\) \+ max\(14px, env\(safe-area-inset-top\)\)\); left: 50%; transform: translateX\(-50%\); \}/, "logo centré et fixe, sous le bandeau hors connexion sans recompter sa hauteur");
  assert.match(css, /\.pub-header::before \{[^}]*position: fixed;[^}]*opacity: 0;/, "barre translucide derrière le logo, invisible en haut de page");
  assert.match(css, /\.pub-header\[data-scrolled="true"\]::before \{ opacity: 1; \}/, "…et visible dès que la page défile");
  assert.match(header, /data-scrolled=\{scrolled \? "true" : "false"\}/, "PublicHeader pose data-scrolled");
  assert.doesNotMatch(css, /\.pub-header--connected \{[^}]*(background|backdrop-filter)/, "pas de fond non plus pour un visiteur connecté");
  assert.match(css, /\.pub-return-link \{ position: fixed;/, "« Retour à mon espace » est fixe à gauche du logo");
  assert.match(css, /\.pub-burger \{ position: fixed; z-index: 840; left: 50%; bottom: calc\(18px \+ env\(safe-area-inset-bottom\)\);/);
  const brand = header.slice(header.indexOf('className="pub-header"'), header.indexOf("</header>"));
  assert.doesNotMatch(brand, /Mon E[‑-]Carnet<\/span>/, "le logo de l'en-tête n'a pas de nom écrit à côté");
  const connected = header.slice(header.indexOf('className="pub-header pub-header--connected"'), header.indexOf("</header>", header.indexOf('className="pub-header pub-header--connected"')));
  assert.match(connected, /className="brand"/, "le visiteur connecté voit aussi le logo centré");
});

test("menu plein écran : sur ordinateur les liens sont centrés (plus d'escalier), le losange ne décale pas le mot", () => {
  const css = read("src/app/site-pages.css");
  assert.doesNotMatch(css, /--off/, "plus de décalage en escalier");
  assert.match(css, /@media \(min-width: 900px\) \{\s*\.pub-nav__link \{ justify-content: center; text-align: center; \}/);
  assert.match(css, /\.pub-nav__dot \{ position: absolute; left: calc\(100% \+ \.16em\);/);
  assert.match(read("src/components/public/PublicHeader.tsx"), /<span className="pub-nav__text">\{children\}<span className="pub-nav__dot" aria-hidden="true" \/><\/span>/);
});

test("menu public : liens sans Sécurité, langues Google Translate, e-mail / WhatsApp / Facebook et © 2026", () => {
  const header = read("src/components/public/PublicHeader.tsx");
  for (const href of ["/#parcours", "/#profils", "/#questions", "/a-propos", "/#contact", "/connexion"]) assert.ok(header.includes(`href="${href}"`), href);
  assert.ok(!header.includes('href="/securite"'), "Sécurité ne figure pas dans le menu");
  assert.match(header, /useLanguageChooser\(\)/);
  assert.match(header, /LANGUAGES\.map/);
  assert.match(header, /socialLinks\(\)/);
  assert.match(header, /© 2026/);
  const social = read("src/lib/social.ts");
  for (const id of ['"email"', '"whatsapp"', '"facebook"']) assert.ok(social.includes(id), id);
  assert.match(social, /NEXT_PUBLIC_FACEBOOK_URL/);
});

test("pied de page : e-mail, WhatsApp et Facebook à la place de l'aide et de la sécurité", () => {
  const shell = read("src/components/public/PublicShell.tsx");
  const icons = shell.slice(shell.indexOf('className="pub-footer__icons"'), shell.indexOf("</nav>", shell.indexOf('className="pub-footer__icons"')));
  assert.match(icons, /socialLinks\(\)/);
  assert.doesNotMatch(icons, /name="help"|name="shield"/);
});

// ---------- Retouches du 18/11/2026 : héro (menu et avis cachés), en-tête fixe, étoiles de la connexion ----------

test("héro : le menu fixé en bas et le bouton d'avis sont cachés tant que le héro occupe l'écran", () => {
  const header = read("src/components/public/PublicHeader.tsx");
  assert.match(header, /function useHeroGate\(enabled: boolean\)/);
  assert.match(header, /document\.querySelector<HTMLElement>\("\[data-hero\]"\)/);
  assert.match(header, /root\.dataset\.inHero = "true"/);
  assert.match(header, /delete root\.dataset\.inHero/, "l'attribut est retiré en quittant la page");
  assert.match(header, /useHeroGate\(pathname === "\/"\)/, "seulement sur la landing");
  const css = read("src/app/site-pages.css");
  assert.match(css, /html\[data-in-hero="true"\] \.pub-burger \{ opacity: 0; visibility: hidden; pointer-events: none;/);
  assert.match(css, /html\[data-in-hero="true"\] \.feedback-fab \{ opacity: 0; visibility: hidden; pointer-events: none;/);
});

test("hors connexion : le logo est fixe sous le bandeau (plus de double décalage) et les ancres tiennent compte de la barre fixe", () => {
  const css = read("src/app/site-pages.css");
  assert.doesNotMatch(css, /\.pub-header \.brand \{ position: absolute/, "le logo n'est plus absolu dans un en-tête déjà poussé par le bandeau");
  assert.match(css, /\.pub \{ --pub-header-h: 0px; --pub-bar-h: /);
  assert.match(read("src/app/landing-showcase.css"), /scroll-margin-top: calc\(var\(--pub-header-h, 0px\) \+ var\(--pub-bar-h, 0px\) \+ var\(--net-banner-h, 0px\) \+ 12px\)/);
  assert.match(read("src/components/motion/useSmoothScroll.ts"), /export const topBarBottom = /);
  assert.match(read("src/components/motion/InfoPageMotion.tsx"), /offset: -\(topBarBottom\(\) \+ 4\)/);
});

test("étoiles du héro : le même astérisque jaune que celui de la page de connexion", () => {
  const login = read("src/components/AuthForms.tsx");
  const glyph = login.match(/className="ax-glyph"[^>]*><path d="([^"]+)"/);
  assert.ok(glyph, "l'astérisque de la connexion existe");
  const page = read("src/app/page.tsx");
  assert.ok(page.includes(`<path d="${glyph[1]}" />`), "la page d'accueil reprend exactement le même tracé");
  assert.doesNotMatch(page, /M12 0c\.7 7\.2/, "plus d'étoile à quatre branches");
  const hero = read("src/app/landing-hero.css");
  assert.match(hero, /\.lp-hero__star \{[^}]*fill: none; stroke: currentColor; stroke-width: 2\.6; stroke-linecap: round;/);
  assert.match(read("src/app/connexion/auth-immersive.css"), /\.ax-glyph \{[^}]*stroke: var\(--brand-3\); stroke-width: 2\.6; stroke-linecap: round;/);
  for (const id of ["a", "b", "c"]) assert.match(hero, new RegExp(`\\.lp-hero__star--${id} \\{[^}]*color: var\\(--brand-3\\);`), `étoile ${id} jaune`);
  assert.doesNotMatch(hero, /\.lp-hero__star--[abc] \{[^}]*color: var\(--primary\)/, "plus d'étoile verte");
});
