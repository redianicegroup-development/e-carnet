// Garde-fous des pages d'information (légales, crédits, à propos) : schémas SVG animés + défilement Lenis.
// Principes vérifiés : le contenu reste lisible sans JavaScript, le mouvement respecte « mouvement réduit »,
// les schémas ne contiennent que des textes issus de la config ou de la page (jamais d'information inventée),
// et les pages légales ne promettent rien (ni conformité, ni sécurité maximale).
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const src = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const figureFiles = readdirSync(new URL("../src/components/public/figures/", import.meta.url)).filter((file) => file.endsWith(".tsx"));
const css = src("app/info-pages.css");
const motion = src("components/motion/InfoPageMotion.tsx");

test("chaque page d'information est enveloppée par InfoPageMotion (Lenis + schémas)", () => {
  assert.match(src("components/public/LegalDocument.tsx"), /<InfoPageMotion kind="legal">/);
  for (const page of ["a-propos", "credits", "conditions-rattachement"]) {
    assert.match(src(`app/${page}/page.tsx`), /<InfoPageMotion>/, `${page} sans InfoPageMotion`);
  }
  assert.match(src("app/layout.tsx"), /import "\.\/info-pages\.css"/);
});

test("le défilement fluide passe par le hook Lenis existant et laisse le sommaire défiler seul", () => {
  assert.match(motion, /useSmoothScroll\(\)/);
  assert.match(motion, /lenis\.current/);
  assert.match(motion, /scrollTo\(target, \{ offset: -\(stickyHeaderHeight\(\) \+ 16\)/);
  assert.match(src("components/public/LegalDocument.tsx"), /className="legal__side" data-lenis-prevent/);
});

test("le mouvement des schémas est réservé à « mouvement non réduit » et jamais posé dans le CSS", () => {
  assert.match(motion, /mm\.add\("\(prefers-reduced-motion: no-preference\)"/);
  // les états de départ (cachés, repliés) sont posés par GSAP seulement ; sans JavaScript tout reste affiché
  for (const hidden of [/\.fg-(pop|draw|fade)[^{]*\{[^}]*(opacity: 0|visibility: hidden|stroke-dashoffset)/, /\.trail__item[^{]*\{[^}]*(opacity: 0|visibility: hidden)/]) {
    assert.doesNotMatch(css, hidden, "un état caché ne doit pas venir du CSS");
  }
  assert.match(css, /prefers-reduced-motion: no-preference\) \{[^}]*\.fg-float/s, "les animations CSS décoratives sont sous no-preference");
  assert.match(css, /\.pm-ready \.trail__item:not\(\.is-on\)/, "l'état « pas encore atteint » n'existe que si le script a démarré");
});

test("les aides à la lecture des pages légales fonctionnent aussi en mouvement réduit", () => {
  const legalBlock = motion.slice(motion.indexOf('if (kind === "legal")'), motion.indexOf("const mm = gsap.matchMedia()"));
  for (const needle of ["data-reading-time", "[data-spy]", "[data-toc]", "ScrollTrigger.create"]) assert.ok(legalBlock.includes(needle), `${needle} absent du bloc « lecture »`);
  const doc = src("components/public/LegalDocument.tsx");
  assert.match(doc, /data-spy/);
  assert.match(doc, /data-toc=\{section\.id\}/);
  assert.match(doc, /<details className="card legal__tocm">/, "sommaire mobile repliable");
});

test("les schémas n'utilisent que les variables du thème (pas de couleur codée en dur)", () => {
  const stripped = css.replace(/url\("data:[^"]*"\)/g, "");
  assert.doesNotMatch(stripped, /#[0-9a-fA-F]{3,8}\b/, "couleur hexadécimale dans info-pages.css");
  assert.doesNotMatch(stripped, /\brgba?\(/i, "rgb() dans info-pages.css");
  for (const file of figureFiles.filter((name) => name !== "CreditsFigures.tsx")) {
    assert.doesNotMatch(readFileSync(new URL(`../src/components/public/figures/${file}`, import.meta.url), "utf8"), /#[0-9a-fA-F]{3,8}\b|fill="(?!none|currentColor|var\()/, `${file} : couleur en dur`);
  }
  // seule exception : le signe de la marque, qui reprend les couleurs de BrandLogo avec les mêmes variables de repli
  assert.match(src("components/public/figures/CreditsFigures.tsx"), /var\(--brand-spine, #2C3A33\)/);
});

test("chaque schéma est annoncé par un résumé accessible et sa légende reste lisible", () => {
  const parts = src("components/public/figures/parts.tsx");
  assert.match(parts, /role="img" aria-label=\{label\}/);
  assert.match(parts, /\{caption && <figcaption>/);
  assert.match(parts, /<svg className="fig__svg"[^>]*aria-hidden="true"/);
  assert.match(src("components/public/figures/Steps.tsx"), /className="fig-steps" aria-hidden="true"/, "les étapes répètent un texte déjà présent : masquées aux lecteurs d'écran");
  assert.match(src("components/public/figures/Steps.tsx"), /className="trail"/, "« steps » est déjà pris par globals.css (onboarding)");
});

test("les textes des schémas viennent de la config ou de la page : hébergeurs, cookies, durées, équipe", () => {
  assert.match(src("components/public/figures/HostingFigure.tsx"), /import \{ HOSTS \} from/);
  assert.match(src("components/public/figures/CookiesFigure.tsx"), /import \{ COOKIES \} from/);
  assert.match(src("components/public/figures/CreditsFigures.tsx"), /CREDITS_TEAM/);
  const cgu = src("app/cgu/page.tsx");
  assert.match(cgu, /\$\{TECH_VALIDITY\.qr\}/);
  assert.match(cgu, /\$\{TECH_VALIDITY\.accessInitial\}/);
  assert.doesNotMatch(cgu.slice(cgu.indexOf("<Steps"), cgu.indexOf("</Steps>") > 0 ? cgu.indexOf("</Steps>") : cgu.indexOf("<ol>")), /\b\d+ (minutes|heures)\b/, "durée écrite en dur dans le schéma des CGU");
  const credits = src("components/public/figures/CreditsFigures.tsx");
  for (const tech of ["Next.js", "Django", "PostgreSQL"]) {
    assert.ok(credits.includes(tech), `${tech} absent du schéma de la pile`);
    assert.ok(src("lib/credits.ts").includes(tech), `${tech} absent de CREDITS_BUILT_WITH`);
  }
});

test("les schémas ne dessinent ni nom de personne, ni promesse, ni information absente de la page", () => {
  const forbidden = [/\b100 ?%/, /(?<!ne )garantit\b/i, /conforme à la loi/i, /conformité garantie/i, /\bcertifié\b/i, /sécurité maximale/i, /\b(totalement|entièrement|parfaitement) (sécurisé|protégé)\b/i, /\bsécurisé\b/i, /\bprotégé\b/i];
  for (const file of figureFiles) {
    const source = readFileSync(new URL(`../src/components/public/figures/${file}`, import.meta.url), "utf8");
    for (const pattern of forbidden) assert.doesNotMatch(source, pattern, `${file} : formulation interdite ${pattern}`);
  }
  // un schéma ne montre pas de cadenas devant un destinataire qui reçoit des données (prestataires, équipe)
  const recipients = src("components/public/figures/RecipientsFigure.tsx");
  assert.match(recipients, /id: "tech"[^}]*gate: "plain"/);
  assert.match(recipients, /id: "team"[^}]*gate: "plain"/);
  // les pages légales gardent leurs garde-fous : le schéma des destinataires reprend la phrase du tableau
  assert.ok(recipients.includes("Un rattachement à un établissement ne donne pas, à lui seul, accès à un dossier patient."));
  assert.ok(src("app/confidentialite/page.tsx").includes("RecipientsFigure"));
});

test("les anciennes classes CSS de À propos (about-chain) ne subsistent plus et la page garde ses ancres", () => {
  assert.doesNotMatch(src("app/site-pages.css"), /about-chain/);
  const about = src("app/a-propos/page.tsx");
  for (const id of ['id="constat"', 'id="solution"', 'id="equipe"', "fini ou rempli", "CREDITS_TEAM.map"]) assert.ok(about.includes(id), `${id} absent de À propos`);
});
