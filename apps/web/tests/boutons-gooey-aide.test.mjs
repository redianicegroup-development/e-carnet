// Trois types de boutons, gooey à toute apparition, centre d'aide unique, carte d'appel à l'action lisible.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const help = await import("../src/components/help/helpContent.ts");

test("goo.css : tout est préfixé par body, le gooey ne touche que des calques décoratifs, le mouvement réduit est respecté", () => {
  const goo = read("src/app/goo.css");
  const selectors = strip(goo).split("\n").map((line) => line.trim()).filter((line) => /^[.a-z]/.test(line) && line.includes("{"));
  assert.deepEqual(selectors.filter((line) => !/^(body|@)/.test(line) && !/^\d+%/.test(line)), []);
  assert.doesNotMatch(goo, /localStorage|@import|url\(["']?https?:/);
  assert.match(goo, /body \.button \{ animation: goo-button-grow/);
  assert.match(read("src/app/soft-skin.css"), /filter: url\(#ecarnet-gooey-soft\)/);
  assert.match(goo, /filter: url\(#ecarnet-gooey\)/);
  for (const frames of ["goo-in", "goo-button-grow", "goo-panel-in", "goo-blob-grow", "goo-item-in", "goo-anchor", "goo-layer-life"]) assert.match(goo, new RegExp(`@keyframes ${frames}\\b`));
  assert.match(goo, /@media \(prefers-reduced-motion: no-preference\)/);
  assert.match(goo, /@media \(prefers-reduced-motion: reduce\) \{\s*body \.goo-layer \{ display: none; \}/);
  // le filtre n'est jamais posé sur un bouton, un panneau ou du texte : seulement sur des pseudo-éléments et sur le calque aria-hidden
  assert.doesNotMatch(strip(goo), /body \.(button|modal-dialog|settings-modal|feedback-dialog|product-survey-dialog) \{[^}]*filter:/);
  const layout = read("src/app/layout.tsx");
  assert.ok(layout.indexOf('import "./soft-skin.css"') < layout.indexOf('import "./goo.css"'));
  // la peau reste sans pseudo-élément : le gooey a son propre fichier
  assert.doesNotMatch(strip(read("src/app/soft-skin.css")), /::before|::after/);
});

test("trois types de boutons : principal, secondaire, discret ; danger est une couleur, small et block des tailles", () => {
  const skin = read("src/app/soft-skin.css");
  assert.match(skin, /body \.button\.primary\b/);
  assert.match(skin, /body \.button\.ghost\b/);
  assert.match(skin, /body \.button\.danger \{ color: var\(--danger\); \}/);
  assert.match(skin, /body \.button\.primary\.danger \{/);
  // les anciens boutons à style propre passent par .button
  assert.match(read("src/components/AuthForms.tsx"), /button primary ax-submit/);
  assert.match(read("src/components/AuthForms.tsx"), /button ax-social/);
  assert.match(read("src/components/auth/RecoveryFlow.tsx"), /button primary ax-submit/);
  assert.match(read("src/components/auth/RecoveryRequestForm.tsx"), /button primary ax-submit/);
  assert.match(read("src/components/PwaInstallButton.tsx"), /button primary pwa-install-button/);
  assert.match(read("src/components/LandingFeedbackWidget.tsx"), /button feedback-fab/);
  assert.match(read("src/components/CookieConsentBanner.tsx"), /button primary cookie-consent__accept/);
  assert.match(read("src/components/CookieConsentBanner.tsx"), /button cookie-consent__reject/);
  // la confirmation destructive est le bouton principal en rouge, sans règle propre à la modal
  assert.match(read("src/components/modal/ConfirmProvider.tsx"), /"button primary danger"/);
  assert.doesNotMatch(read("src/components/modal/modal.css"), /\.modal-confirm \.button\.danger/);
  // plus de bouton « maison » : les anciennes classes n'ont plus d'apparence propre
  const auth = read("src/app/connexion/auth-immersive.css");
  assert.doesNotMatch(auth, /^\s*\.ax-submit(:[a-z()-]+)* \{[^}]*(background|border-radius|box-shadow)/m);
  assert.doesNotMatch(auth, /\.ax-submit::before/);
  assert.doesNotMatch(read("src/app/globals.css"), /\.feedback-fab \{[^}]*(background|box-shadow|border-radius)/);
  assert.doesNotMatch(read("src/app/cookie-consent.css"), /cookie-consent__actions button \{[^}]*background/);
});

test("toute modal et toute confirmation apparaît par le calque gooey, calé sur son panneau", () => {
  const layer = read("src/components/ui/GooLayer.tsx");
  assert.match(layer, /offsetWidth/);
  assert.match(layer, /ResizeObserver/);
  assert.match(layer, /aria-hidden="true"/);
  for (const file of ["modal/ConfirmProvider", "AuthForms", "SettingsModal", "LandingFeedbackWidget", "ProductSurveyModal", "ProductExperienceSurveyModal"]) {
    assert.match(read(`src/components/${file}.tsx`), /<GooLayer target=\{/, `${file} doit poser le calque gooey`);
  }
  // le calque vient après le panneau : sa référence existe quand il se cale
  for (const file of ["modal/ConfirmProvider", "SettingsModal", "LandingFeedbackWidget"]) {
    const source = read(`src/components/${file}.tsx`);
    assert.ok(source.indexOf("</section>") < source.indexOf("<GooLayer"), `${file} : le calque doit suivre le panneau`);
  }
});

test("la carte « Préparez votre prochaine consultation » est lisible : texte de la couleur du thème, bouton principal", () => {
  const skin = strip(read("src/app/soft-skin.css"));
  assert.match(skin, /body \.cta-card \{[^}]*background: var\(--bg\)[^}]*color: var\(--text\)/);
  assert.match(skin, /body \.cta-card \.muted \{ color: var\(--text-muted\); \}/);
  assert.match(read("src/components/PatientHome.tsx"), /key: "prepare", href: "\/patient\/consultations#preparer"/, "la préparation de la consultation est une ligne du bloc « À faire »");
  // aucune carte ne garde un texte blanc sur le fond du thème : le seul texte clair restant d'une .card est celui de .cta-card, corrigé ci-dessus
  assert.doesNotMatch(skin, /body \.cta-card[^{]*\{[^}]*color: (#fff|white|var\(--on-primary\))/);
});

test("un seul centre d'aide : /aide, /faq redirige, les liens et le sitemap suivent", () => {
  assert.equal(fs.existsSync(path.join(root, "src/app/faq")), false);
  assert.match(read("next.config.ts"), /source: "\/faq", destination: "\/aide", permanent: true/);
  const page = read("src/app/aide/page.tsx");
  assert.match(page, /HelpCenter/);
  assert.doesNotMatch(page, /help-accordion|help-quicklinks|Vous pouvez le révoquer/);
  const sitemap = read("public/sitemap.xml");
  assert.match(sitemap, /\/aide</);
  assert.doesNotMatch(sitemap, /\/faq</);
  for (const file of ["src/components/public/PublicShell.tsx", "src/components/SettingsMoreSection.tsx", "src/components/public/LegalDocument.tsx", "src/components/EstablishmentHelp.tsx", "src/app/credits/page.tsx"]) {
    assert.doesNotMatch(read(file), /["']\/faq/, `${file} pointe encore vers /faq`);
  }
  // ancres : celles qui restent utilisées existent dans l'aide
  const anchors = new Set([...help.HELP_FAQ.map((group) => group.id), ...help.HELP_PROFILES.map((profile) => profile.id), "questions", "depannage", "glossaire", "guides"]);
  for (const file of ["src/components/shell/SpaceShell.tsx", "src/app/securite/page.tsx", "src/app/page.tsx", "src/components/EstablishmentWorkspace.tsx", "src/components/EstablishmentConsole.tsx", "src/app/etablissement/aide/page.tsx", "src/components/EstablishmentHelp.tsx"]) {
    for (const match of read(file).matchAll(/\/aide#([a-z-]+)/g)) assert.ok(anchors.has(match[1]), `${file} : ancre /aide#${match[1]} absente de l'aide`);
  }
});

test("le centre d'aide est cherchable, filtrable par profil et reprend le contenu de l'ancienne page /aide", () => {
  const browser = read("src/components/help/HelpBrowser.tsx");
  assert.match(browser, /type="search"/);
  assert.match(browser, /aria-pressed=\{profile === /);
  assert.match(browser, /aria-live="polite"/);
  assert.match(browser, /normalize\("NFD"\)/);
  const ids = help.HELP_FAQ.map((group) => group.id);
  for (const id of ["premiers-pas", "acces", "comptes", "preferences", "donnees", "retours"]) assert.ok(ids.includes(id), `rubrique ${id} absente`);
  const questions = help.HELP_FAQ.flatMap((group) => group.items.map((item) => item.q));
  assert.equal(new Set(questions).size, questions.length);
  assert.ok(questions.length >= 24);
  // la formulation écartée par la revue juridique ne revient pas par les nouvelles entrées
  for (const item of help.HELP_FAQ.flatMap((group) => group.items)) assert.doesNotMatch(item.a, /à tout moment|100 ?%|garanti/i, item.q);
});

test("la landing a six sections et renvoie le reste vers le centre d'aide", () => {
  const page = read("src/app/page.tsx");
  for (const id of ["fonctionnalites", "parcours", "profils"]) assert.match(page, new RegExp(`id="${id}"`));
  assert.match(page, /<FaqSection \/>/);
  assert.match(page, /<ContactSection /);
  assert.match(read("src/components/landing/FaqSection.tsx"), /href="\/aide"/);
  assert.match(read("src/components/landing/ContactSection.tsx"), /FINAL\.title/);
});
