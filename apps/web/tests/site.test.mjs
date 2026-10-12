// Garde-fous du site public : liens légaux visiteurs/connectés, crédits, icônes et favicon, aide sans promesse.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url).pathname;
const read = (rel) => readFileSync(`${root}${rel}`, "utf8");
const legal = await import("../src/lib/legal/config.ts");
const help = await import("../src/components/help/helpContent.ts");
const credits = await import("../src/lib/credits.ts");

const routeExists = (href) => existsSync(`${root}src/app${href.split("#")[0]}/page.tsx`);
const hrefsOf = (source) => [...source.matchAll(/href[:=]\s*[{"]\s*"?(\/[a-z0-9/#-]*)/g)].map((m) => m[1]);

test("visiteurs : le pied de page public renvoie vers les trois pages légales", () => {
  const footer = read("src/components/public/PublicShell.tsx");
  for (const doc of Object.values(legal.LEGAL_DOCS)) assert.ok(footer.includes(`LEGAL_DOCS.${Object.keys(legal.LEGAL_DOCS).find((k) => legal.LEGAL_DOCS[k] === doc)}.path`), `pied de page : lien manquant vers ${doc.path}`);
  assert.match(footer, /href="\/credits"/, "pied de page : lien Crédits manquant");
  assert.match(read("src/app/connexion/page.tsx"), /href="\/cgu"[\s\S]*href="\/confidentialite"|href="\/mentions-legales"/, "page de connexion : liens légaux manquants");
});

test("connectés : Paramètres › En savoir plus renvoie vers les pages légales et les crédits, sans « À venir »", () => {
  const more = read("src/components/SettingsMoreSection.tsx");
  const hrefs = hrefsOf(more);
  for (const doc of Object.values(legal.LEGAL_DOCS)) assert.ok(hrefs.includes(doc.path), `En savoir plus : ${doc.path} manquant`);
  for (const must of ["/credits", "/faq"]) assert.ok(hrefs.includes(must), `En savoir plus : ${must} manquant`);
  assert.ok(hrefs.every(routeExists), `routes absentes : ${hrefs.filter((h) => !routeExists(h)).join(", ")}`);
  assert.doesNotMatch(more, /À venir|comingSoon/);
  for (const settings of ["AccountSettingsClient", "ProfessionalSettingsClient", "EstablishmentSettingsClient"]) {
    const file = `src/components/${settings}.tsx`;
    if (existsSync(`${root}${file}`)) assert.match(read(file), /SettingsMoreSection/, `${settings} n'affiche plus la rubrique En savoir plus`);
  }
});

test("crédits : Redianice est identifiée comme startup ayant contacté AKATech Studio", () => {
  assert.deepEqual(credits.CREDITS_ORIGINS.map((c) => c.name), ["Redianice", "AKATech Studio"]);
  assert.match(credits.CREDITS_UPDATED, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(read("src/app/credits/page.tsx"), /Redianice, une startup, a contacté AKATech Studio/);
});

test("marque : l'ancienne tuile « + » n'est plus dessinée, le logo est le composant BrandMark", () => {
  const walk = (dir) => readdirSync(dir).flatMap((n) => { const f = `${dir}/${n}`; return statSync(f).isDirectory() ? walk(f) : /\.tsx$/.test(n) ? [f] : []; });
  const old = walk(`${root}src`).filter((f) => /className="brand-mark"/.test(readFileSync(f, "utf8")));
  assert.deepEqual(old, [], `ancienne marque encore présente : ${old.join(", ")}`);
});

test("les trois espaces paramètres utilisent des icônes SVG sémantiques, sans glyphes de substitution", () => {
  const files = ["AccountSettingsClient", "ProfessionalSettingsClient", "EstablishmentSettingsClient"];
  const sources = files.map((name) => read(`src/components/${name}.tsx`));
  for (const source of sources) assert.doesNotMatch(source, /icon:\s*"(?:ID|▣|◉|i|✎|⌖|♡)"/);
  assert.match(sources[0], /icon: "idcard"[\s\S]*icon: "heart"[\s\S]*icon: "sparkle"[\s\S]*icon: "lock"[\s\S]*icon: "help"[\s\S]*icon: "pencil"/);
  assert.match(sources[1], /icon: "stethoscope"[\s\S]*icon: "building"[\s\S]*icon: "sparkle"[\s\S]*icon: "lock"[\s\S]*icon: "help"[\s\S]*icon: "pencil"/);
  assert.match(sources[2], /icon: "building"[\s\S]*icon: "pin"[\s\S]*icon: "sparkle"[\s\S]*icon: "lock"[\s\S]*icon: "help"[\s\S]*icon: "pencil"/);
  assert.match(read("src/components/SettingsDirectory.tsx"), /Icon name=\{item\.icon\}/);
});

test("la connexion conserve son animation GSAP/Lenis et les styles de mouvement réduit", () => {
  const page = read("src/app/connexion/page.tsx");
  const motion = read("src/components/motion/AuthMotion.tsx");
  const styles = read("src/app/connexion/auth-immersive.css");
  const pkg = JSON.parse(read("package.json"));
  assert.match(page, /AuthMotion/);
  assert.match(page, /PulseLine/);
  assert.match(page, /auth-immersive\.css/);
  assert.match(motion, /useSmoothScroll\(\)/);
  assert.match(motion, /useGSAP/);
  assert.match(motion, /prefers-reduced-motion: no-preference/);
  assert.match(styles, /auth-shell--immersive/);
  assert.equal(pkg.dependencies.gsap, "^3.15.0");
  assert.equal(pkg.dependencies.lenis, "^1.3.26");
});

test("le lien admin est dans la navigation patient et la gestion du compte dans la sécurité des trois espaces", () => {
  const settings = read("src/components/AccountSettingsClient.tsx");
  const shell = read("src/components/shell/SpaceShell.tsx");
  const professional = read("src/components/ProfessionalSettingsClient.tsx");
  const establishment = read("src/components/EstablishmentSettingsClient.tsx");
  const patientForm = read("src/components/AccountActionRequestsSettingsClient.tsx");
  const adminPanel = read("src/components/AdminAccountActionRequestsClient.tsx");
  const adminPage = read("src/app/admin/page.tsx");
  const css = read("src/app/globals.css");
  assert.doesNotMatch(settings, /gestion-compte|id: "administration"|e-carnetci\.vercel\.app\/admin/);
  assert.match(shell, /space === "patient" && state\.status === "ready" && state\.account\.is_admin === true/);
  assert.match(shell, /space-nav--admin/);
  assert.match(shell, /href="https:\/\/e-carnetci\.vercel\.app\/admin\/"/);
  assert.match(css, /\.space-nav--admin ul \{ grid-template-columns: repeat\(6/);
  assert.match(settings, /activeSection === "securite"[\s\S]*AccountActionRequestsSettingsClient/);
  assert.match(professional, /activeSection === "securite"[\s\S]*AccountActionRequestsSettingsClient/);
  assert.match(establishment, /activeSection === "securite"[\s\S]*AccountActionRequestsSettingsClient/);
  assert.match(patientForm, /request_type: requestType/);
  assert.match(patientForm, /value="other"/);
  assert.match(patientForm, /useConfirm/);
  assert.match(patientForm, /sans attendre d’agrément/);
  assert.match(patientForm, /accountDeleted=1/);
  assert.match(patientForm, /account-requests/);
  assert.match(adminPanel, /admin\/account-requests/);
  assert.match(adminPanel, /\/delete\//);
  assert.match(adminPanel, /protected_account/);
  assert.match(adminPage, /AdminAccountActionRequestsClient/);
  assert.match(adminPage, /admin-sidebar/);
  assert.match(adminPage, /Gestion des comptes/);
});

test("favicon, ICO et icônes PWA : les fichiers déclarés existent et sont valides", () => {
  const layout = read("src/app/layout.tsx");
  const urls = [...layout.matchAll(/url:\s*"([^"]+)"/g)].map((m) => m[1]).concat(["/favicon.ico"]);
  for (const url of new Set(urls)) assert.ok(existsSync(`${root}public${url}`), `icône déclarée mais absente : ${url}`);
  const ico = readFileSync(`${root}public/favicon.ico`);
  assert.equal(ico.readUInt16LE(0), 0); assert.equal(ico.readUInt16LE(2), 1);
  assert.ok(ico.readUInt16LE(4) >= 3, "l'ICO doit contenir au moins 16, 32 et 48 px");
  const manifest = JSON.parse(read("public/manifest.webmanifest"));
  for (const icon of manifest.icons) {
    assert.ok(existsSync(`${root}public${icon.src}`), `manifest : ${icon.src} absent`);
    if (icon.src.endsWith(".png")) {
      const png = readFileSync(`${root}public${icon.src}`);
      assert.equal(png.readUInt32BE(16), Number(icon.sizes.split("x")[0]), `${icon.src} : taille déclarée ≠ taille réelle`);
    }
  }
  assert.ok(manifest.icons.some((i) => i.purpose === "maskable"), "icône maskable manquante");
  assert.match(layout, /site-pages\.css/, "layout : feuille site-pages.css non importée");
});

test("aide : aucune promesse ni terme que la revue juridique déconseille", () => {
  const source = read("src/components/help/helpContent.ts").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""); // les commentaires peuvent citer les termes interdits
  for (const pattern of [/à tout moment/i, /\bmédecins? vérifiés?\b/i, /doit être vérifié/i, /professionnels? vérifiés?\b/i, /en un scan/i, /garanti/i, /100 ?%/]) assert.doesNotMatch(source, pattern, `aide : formulation interdite ${pattern}`);
  for (const profile of help.HELP_PROFILES) assert.ok(profile.steps.length >= 4, `${profile.id} : parcours trop court`);
  const questions = help.HELP_FAQ.flatMap((g) => g.items.map((i) => i.q));
  assert.equal(new Set(questions).size, questions.length, "questions en double");
  assert.ok(questions.length >= 12, "FAQ trop courte pour une aide enrichie");
  assert.match(source, /données fictives/, "l'aide doit rappeler la version de test");
});
