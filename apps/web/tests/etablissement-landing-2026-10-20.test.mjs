// Lot du 20/10 : réglages pro et établissement, logo et nom modifiable, fiche, console équipe responsive, hero et pied de page.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), "utf8");

test("pro et établissement ont le même en-tête de paramètres que le patient (plus de nom écrasé par la notice)", () => {
  for (const file of ["src/components/ProfessionalSettingsClient.tsx", "src/components/EstablishmentSettingsClient.tsx"]) {
    const source = read(file);
    assert.match(source, /card [a-z-]*\s?account-summary settings-account-summary|account-summary settings-account-summary/);
    assert.match(source, /settings-account-summary__row/);
    assert.match(source, /settings-account-summary__copy/);
    assert.match(source, /establishment-settings\.css/);
  }
  const css = read("src/components/establishment-settings.css");
  assert.match(css, /\.account-summary\.settings-account-summary \{ display: grid;/);
});

test("« Informations administratives » et « Coordonnées » se modifient, avec logo, via un seul formulaire partagé", () => {
  const settings = read("src/components/EstablishmentSettingsClient.tsx");
  assert.match(settings, /<EstablishmentProfileEditor key=\{selected\.id\} scope="identity"/);
  assert.match(settings, /<EstablishmentProfileEditor key=\{selected\.id\} scope="contact"/);
  assert.match(settings, /function applySaved\(profile: EstablishmentProfile\)/);
  assert.match(settings, /avatar--logo/);
  const editor = read("src/components/EstablishmentProfileEditor.tsx");
  assert.match(editor, /<AvatarPicker subject="logo"/);
  assert.match(editor, /name="?[^>]*|autoComplete="organization"/);
  assert.match(editor, /Adresse ou BP \(facultatif\)/);
  assert.match(editor, /E‑mail de la structure \(verrouillé\)[\s\S]*readOnly/);
  assert.doesNotMatch(editor, /E‑mail de contact de la structure/);
  // le logo n'est envoyé que s'il a changé
  assert.match(editor, /if \(scope !== "contact" && logoChanged\) body\.logo = logo;/);
});

test("fiche d'onboarding : logo, nom pré-rempli modifiable, ville, adresse facultative, e-mail du compte verrouillé", () => {
  const form = read("src/components/EstablishmentProfileForm.tsx");
  assert.match(form, /<EstablishmentProfileEditor\s+scope="all"/);
  assert.match(form, /recovery_configured/);
  assert.doesNotMatch(form, /Nom vérifié|écrivez‑lui/);
  const editor = read("src/components/EstablishmentProfileEditor.tsx");
  assert.match(editor, /setValues\(\{ name: profile\.name/);
  assert.doesNotMatch(editor, /type="email" autoComplete="email" value=\{values/, "l'e-mail n'est plus saisi");
});

test("console équipe : la carte du tableau ne fait plus déborder la page, et chaque ligne devient une carte sur mobile", () => {
  const css = read("src/components/admin-establishments.css");
  assert.match(css, /\.admin-management-grid > \* \{ min-width: 0; \}/);
  assert.match(css, /@media \(max-width: 860px\)[\s\S]*\.admin-table--stack td\[data-label\]::before \{ content: attr\(data-label\)/);
  const client = read("src/components/AdminEstablishmentsClient.tsx");
  assert.match(client, /admin-table admin-table--stack/);
  assert.match(client, /Dernière mise à jour/);
  assert.match(client, /Renommé par l’établissement le/);
  assert.match(client, /nom vérifié : \{item\.original_name\}/);
  assert.match(client, /admin-structure__logo/);
});

test("hero : le texte révélé est vert (il se confondait avec la photo claire)", () => {
  const css = read("src/app/landing-showcase.css");
  assert.match(css, /\.lp-hero__reveal \{[^}]*color: var\(--primary-text\)/);
  assert.doesNotMatch(css, /\.lp-hero__reveal \{[^}]*color: var\(--bg\)/);
});

test("pied de page : bandeau « Prêt à commencer ? » retiré, slogan du projet partout où le pied de page existe", () => {
  const shell = read("src/components/public/PublicShell.tsx");
  assert.doesNotMatch(shell, /Prêt à commencer|La santé avance vite|pub-footer__cta/);
  assert.match(shell, /<p className="pub-footer__slogan">Gardez le fil avec Mon E‑Carnet\.<\/p>/);
  // pages publiques ET légales passent par ce pied de page
  assert.match(read("src/components/public/LegalDocument.tsx"), /PublicShell|PublicFooter/);
  for (const page of ["a-propos", "aide", "faq", "securite", "credits", "conditions-rattachement"]) assert.match(read(`src/app/${page}/page.tsx`), /PublicShell/);
});

test("boutons flottants : « remonter » reste fixe à droite, « avis » est rond sur PC comme sur mobile", () => {
  const site = read("src/app/site-pages.css");
  // `body .button { position: relative }` (soft-skin) écrasait position: fixed : le bouton tombait sous le pied de page, à gauche
  assert.match(site, /body \.public-scroll-top \{ position: fixed; \}/);
  assert.match(site, /\.public-scroll-top \{[^}]*right: max\(18px/);
  const globals = read("src/app/globals.css");
  assert.match(globals, /\.feedback-fab \{[^}]*width: 48px; height: 48px;[^}]*padding: 0;/);
  assert.match(globals, /\.feedback-fab > span:nth-child\(2\) \{ display: none; \}/);
  assert.match(read("src/components/LandingFeedbackWidget.tsx"), /aria-label="Donner votre avis"/);
});
