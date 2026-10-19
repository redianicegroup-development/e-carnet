// Parcours d'interface ajoutés en V1.8 : confirmations, login, bannière cookies, onboarding établissement.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), "utf8");
const normalize = (text) => text.replace(/\s+/g, " ").trim();

test("les décisions de consentement et les actions irréversibles passent par le modal de confirmation", () => {
  const grants = read("src/components/PatientAccessGrants.tsx");
  assert.match(grants, /async function decide\(/);
  for (const action of ["accept", "refuse", "extend"]) {
    assert.doesNotMatch(grants, new RegExp(`onClick=\\{\\(\\) => act\\(item\\.id, "${action}"\\)`), `« ${action} » ne doit pas partir sans confirmation`);
  }
  for (const file of ["AdminAccountActionRequestsClient", "EstablishmentConsole", "AdminEstablishmentsClient"]) {
    assert.match(read(`src/components/${file}.tsx`), /await confirm\(/, `${file} doit confirmer avant d'agir`);
  }
  assert.match(read("src/components/AdminEstablishmentsClient.tsx"), /tone: "danger"/, "la révocation d'une invitation est une confirmation de type danger");
});

test("le login a deux volets sur grand écran et un écran d'accueil puis un formulaire sur mobile", () => {
  const page = read("src/app/connexion/page.tsx");
  const css = read("src/app/connexion/auth-immersive.css");
  const forms = read("src/components/AuthForms.tsx");
  assert.match(page, /<AuthUiProvider>/);
  assert.match(page, /<AuthWelcome \/>/);
  assert.match(forms, /data-step=\{step\}/);
  assert.match(forms, /ax-welcome-actions/);
  assert.match(css, /@media \(min-width: 860px\)/);
  assert.match(css, /\.ax-card\[data-step="welcome"\] \.ax-form \{ display: none; \}/);
  assert.match(forms, /createPortal\(<AuthErrorDialog/, "la modale d'erreur est rendue dans <body> (un parent transformé ne doit pas rogner son fond)");
  assert.match(forms, /context\.onboarding_completed \? "\/etablissement" : "\/etablissement\/fiche"/);
});

test("le mouvement du login respecte prefers-reduced-motion", () => {
  const motion = read("src/components/motion/AuthMotion.tsx");
  assert.match(motion, /prefers-reduced-motion: no-preference/);
  assert.match(motion, /prefers-reduced-motion: reduce/);
  for (const file of ["src/components/auth/welcome-character.css", "src/app/cookie-consent.css"]) {
    const css = read(file);
    const outsideMedia = css.replace(/@media \(prefers-reduced-motion: no-preference\)[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
    assert.doesNotMatch(outsideMedia, /animation:\s*[a-z-]+\s+[\d.]+s[^;]*infinite/, `${file} : aucune animation infinie hors mouvement autorisé`);
  }
});

test("les tracés animés reprennent exactement les SVG fournis", () => {
  const answer = read("public/answer.svg");
  const answerPaths = [...answer.matchAll(/<path[^>]* d="([^"]+)"/g)].map((match) => match[1]).join(" ");
  assert.equal(normalize(read("src/components/auth/answerPath.ts").match(/ANSWER_PATH = "([^"]+)"/)[1]), normalize(answerPaths));
  const cookie = read("public/cartoon-cookie-choice.svg");
  const cookiePath = cookie.match(/<path[^>]* d="([^"]+)"/)[1];
  assert.equal(normalize(read("src/components/consent/cookiePath.ts").match(/COOKIE_PATH = "([^"]+)"/)[1]), normalize(cookiePath));
});

test("la bannière cookies est themée, accessible et réouvrable", () => {
  const banner = read("src/components/CookieConsentBanner.tsx");
  assert.match(banner, /<CookieIllustration \/>/);
  assert.doesNotMatch(banner, /cartoon-cookie-choice\.svg/, "un SVG en <img> ignorerait la couleur du thème");
  assert.match(banner, /acceptButton\.current\?\.focus\(\)/, "le focus va sur la bannière quand elle est rouverte");
  assert.match(banner, /event\.key === "Escape"/);
  assert.match(read("src/app/cookie-consent.css"), /\.cookie-consent__actions \{[^}]*grid-template-columns: 1fr 1fr/, "Accepter et Refuser ont le même poids");
  assert.match(read("src/components/public/PublicShell.tsx"), /<CookiePreferencesLink[^>]*>Gérer les cookies/);
  assert.match(read("src/components/SettingsMoreSection.tsx"), /<CookieSettingItem \/>/);
});

test("l'onboarding de l'établissement est une fiche à compléter avant d'ouvrir l'espace", () => {
  assert.ok(existsSync(new URL("src/app/etablissement/fiche/page.tsx", root)));
  assert.match(read("src/lib/spaces.ts"), /bare: \["\/etablissement\/activation", "\/etablissement\/fiche"\]/);
  assert.match(read("src/components/shell/SpaceShell.tsx"), /router\.replace\("\/etablissement\/fiche"\)/);
  const activation = read("src/components/EstablishmentInvitationActivation.tsx");
  assert.match(activation, /invitations\/preview\//);
  assert.match(activation, /account_exists|account_exists/);
  const staff = read("src/components/AdminEstablishmentsClient.tsx");
  assert.match(staff, /verification_confirmed/);
  assert.doesNotMatch(staff, /responsible_name|address|establishment_type/, "l'équipe ne saisit plus la fiche de l'établissement");
});


test("l’admin peut transmettre un lien d’activation si la messagerie échoue", () => {
  const staff = read("src/components/AdminEstablishmentsClient.tsx");
  assert.match(staff, /manual_invitation_url/);
  assert.match(staff, /email_delivery === "failed"/);
  assert.match(staff, /Copier le lien/);
  assert.match(staff, /valable 48 heures/);
  assert.doesNotMatch(staff, /le lien n'est jamais affiché/i);
});
