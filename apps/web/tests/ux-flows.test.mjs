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


test("l’équipe reçoit une seule fois le mot de passe temporaire du responsable et le transmet hors application", () => {
  const staff = read("src/components/AdminEstablishmentsClient.tsx");
  assert.match(staff, /temporary_password/);
  assert.match(staff, /Mot de passe temporaire/);
  assert.match(staff, /Copier le message à transmettre/);
  assert.match(staff, /ne sera plus affich/);
  assert.match(staff, /use_existing_account/, "un compte existant n’est rattaché qu’après confirmation explicite");
  assert.doesNotMatch(staff, /manual_invitation_url|email_delivery/, "plus de lien d’invitation ni d’envoi e‑mail");
});

test("le mot de passe temporaire impose son remplacement : écran dédié, redirection depuis la connexion et depuis les espaces", () => {
  assert.ok(existsSync(new URL("src/app/connexion/nouveau-mot-de-passe/page.tsx", root)));
  const screen = read("src/components/auth/PasswordChangeRequired.tsx");
  assert.match(screen, /\/api\/v1\/identity\/me\/password\//);
  assert.match(screen, /current_password/);
  assert.match(screen, /new_password/);
  assert.match(read("src/components/AuthForms.tsx"), /account\.must_change_password\) return "\/connexion\/nouveau-mot-de-passe"/);
  const shell = read("src/components/shell/SpaceShell.tsx");
  assert.match(shell, /must_change_password === true/);
  assert.match(shell, /router\.replace\("\/connexion\/nouveau-mot-de-passe"\)/);
});


test("tous les plier/déplier de l’espace patient suivent le geste de « Ma carte virtuelle » : titre-bouton et chevron qui pivote", () => {
  const section = read("src/components/ui/CollapsibleSection.tsx");
  assert.match(section, /<Icon name="chevron"/);
  assert.match(section, /aria-expanded=\{open\}/);
  assert.doesNotMatch(section, /Afficher|Masquer/, "plus de « + Afficher / − Masquer »");
  const css = read("src/components/patient-sections.css");
  assert.match(css, /carnet-accordion__toggle\[aria-expanded="true"\] \.icon \{ transform: rotate\(90deg\)/);
});

test("les pré-consultations n’ont plus de pli : affichées directement dans le carnet et dans les consultations", () => {
  assert.doesNotMatch(read("src/components/PatientCarnet.tsx"), /CollapsibleSection title="Mes pré-consultations"/);
  assert.doesNotMatch(read("src/app/patient/consultations/page.tsx"), /CollapsibleSection title="Mes pré-consultations"/);
  assert.match(read("src/app/patient/consultations/page.tsx"), /<PatientPreconsultations \/>/);
});

test("l’âge et le genre se renseignent à l’étape 3 de l’onboarding patient", () => {
  const onboarding = read("src/components/PatientOnboarding.tsx");
  assert.match(onboarding, /Étape 3 · identité du titulaire/);
  assert.match(onboarding, /gender: form\.gender/);
  assert.match(onboarding, /function ageLabel/);
  assert.match(onboarding, /<legend>Âge et genre/);
});

test("le dossier patient et le QR de la carte virtuelle forment une seule section d’accueil", () => {
  const home = read("src/components/PatientHomeIdentity.tsx");
  assert.equal((home.match(/<section /g) ?? []).length, 1, "une seule section");
  assert.match(home, /className="card patient-dossier"/);
  assert.match(home, /patient-dossier__qr/);
  assert.doesNotMatch(home, /patient-home-qr|patient-home-profile/);
});

test("QA-01 : 404, erreur, erreur globale et chargement existent et sont sur la marque", () => {
  assert.match(read("src/app/not-found.tsx"), /Cette page n’existe pas/);
  assert.match(read("src/app/not-found.tsx"), /href="\/patient"/);
  const error = read("src/app/error.tsx");
  assert.match(error, /^"use client";/);
  assert.match(error, /ChunkLoadError/, "mise à jour pendant une session ouverte : rechargement proposé");
  assert.match(error, /window\.location\.reload\(\)/);
  assert.match(error, /error\.digest/, "référence à donner au support, jamais la pile technique");
  assert.doesNotMatch(error, /error\.stack/);
  assert.match(read("src/app/global-error.tsx"), /<html lang="fr">/);
  assert.match(read("src/app/loading.tsx"), /ScreenLoader/);
});

test("QA-02 : la longueur minimale du mot de passe ne bloque que l’inscription, pas la connexion", () => {
  assert.match(read("src/components/AuthForms.tsx"), /minLength=\{login \? undefined : 12\}/);
});

test("étape 4 : la question de récupération reste obligatoire et son texte dit la vérité du serveur", () => {
  const setup = read("src/components/RecoverySetup.tsx");
  assert.match(setup, /Étape 4 · récupération du compte</);
  assert.doesNotMatch(setup, /Plus tard|facultative/);
  assert.match(setup, /Quiconque connaît cette réponse peut changer votre mot de passe/);
  // le serveur accepte la réponse seule tant que l'OTP n'existe pas : l'interface ne doit pas affirmer le contraire
  assert.doesNotMatch(setup, /pas activée|ne suffit pas|ne peut pas, à elle seule/);
  assert.match(setup, /SMS/);
  assert.match(read("src/components/AuthForms.tsx"), /!account\.recovery_configured\) return "\/onboarding\/securite"/);
});

test("UX-05 : l’accueil patient ne tombe plus en bloc quand un appel échoue", () => {
  const home = read("src/components/PatientHome.tsx");
  assert.match(home, /Promise\.allSettled/);
  assert.doesNotMatch(home, /Promise\.all\(/);
  assert.match(home, /onClick=\{retry\}/);
  // pas de zéro inventé : une information non chargée reste inconnue
  assert.match(home, /: null\)/);
});

test("UX-02 : l’accueil regroupe les alertes en « À faire » et ne répète plus les onglets", () => {
  const home = read("src/components/PatientHome.tsx");
  assert.match(home, /id="home-todo-title"[^>]*>À faire</);
  assert.doesNotMatch(home, /stat-grid|PatientDashboardChart|progress-card|alert-card"[^>]*aria-live/);
  assert.equal((home.match(/apiGet</g) ?? []).length, 5, "cinq appels au lieu de huit");
  assert.match(home, /className="button primary" href="\/patient\/consultations#preparer"/);
  assert.match(home, /<PatientHomeIdentity account=\{account\} \/>/);
});

test("UX-04 : deux QR, deux noms — carte virtuelle (secours) et accès temporaire de 5 minutes (professionnel)", () => {
  const identity = read("src/components/PatientHomeIdentity.tsx");
  const grants = read("src/components/PatientAccessGrants.tsx");
  const home = read("src/components/PatientHome.tsx");
  assert.match(identity, /voit votre carte virtuelle, sans se connecter/);
  assert.match(identity, /autre QR, valable 5 minutes/);
  assert.match(identity, /href="\/patient\/acces#qr"/);
  assert.match(grants, /Accès temporaire pour un professionnel/);
  assert.match(grants, /Ce n’est pas le QR de votre carte virtuelle/);
  assert.match(home, /Accès temporaire pour un professionnel/);
  for (const text of [identity, grants, home]) assert.doesNotMatch(text, /QR d’accès|QR d'accès|QR public/);
});

test("titres en double : une rubrique « solo » masque le titre répété sous son bouton", () => {
  const section = read("src/components/ui/CollapsibleSection.tsx");
  const css = read("src/components/patient-sections.css");
  const carnet = read("src/components/PatientCarnet.tsx");
  assert.match(section, /solo \? " carnet-accordion__panel--solo" : ""/);
  assert.match(css, /carnet-accordion__panel--solo > \.card > \.section-heading:first-child h2/);
  for (const title of ["Mes documents", "Mes vaccins", "Rappels de médicaments", "Mes plans de suivi", "Rendez-vous"]) assert.match(carnet, new RegExp(`<CollapsibleSection title="${title}" solo>`));
  // Les consultations vivent dans Visites : le carnet ne les répète pas.
  assert.doesNotMatch(carnet, /Mes consultations|PatientConsultations/);
  assert.doesNotMatch(carnet, /<h2>Exporter mon carnet<\/h2>/);
  assert.doesNotMatch(carnet, /<span className="eyebrow">Ma carte d’urgence<\/span>/);
});
