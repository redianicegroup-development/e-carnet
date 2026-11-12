// Paramètres : langue (Google Translate), partage/installation, version ; déconnexion globale dans Sécurité ; carte de consultation et signature requise.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), "utf8");
const language = await import("../src/lib/language.ts");
const info = await import("../src/lib/app-info.ts");
const env = await import("../src/lib/install-environment.ts");

test("langue : français par défaut, anglais et arabe ; le traducteur ne reçoit un cookie que pour l'anglais et l'arabe", () => {
  assert.deepEqual(language.LANGUAGES.map((item) => item.code), ["fr", "en", "ar"]);
  assert.equal(language.DEFAULT_LANGUAGE, "fr");
  assert.equal(language.languageInfo("ar").dir, "rtl");
  assert.equal(language.languageInfo("en").dir, "ltr");
  assert.equal(language.translateCookieValue("fr"), "");
  assert.equal(language.translateCookieValue("en"), "/fr/en");
  assert.equal(language.translateCookieValue("ar"), "/fr/ar");
});

test("langue : la valeur enregistrée est relue avec prudence (inconnue ou stockage refusé = français)", () => {
  assert.equal(language.readStoredLanguage({ getItem: () => "ar" }), "ar");
  assert.equal(language.readStoredLanguage({ getItem: () => "de" }), "fr");
  assert.equal(language.readStoredLanguage({ getItem: () => null }), "fr");
  assert.equal(language.readStoredLanguage({ getItem: () => { throw new Error("refusé"); } }), "fr");
});

test("langue : un consentement explicite précède tout envoi du texte à Google, et rien n'est chargé en français", () => {
  const settings = read("src/components/app/LanguageSettings.tsx");
  assert.match(settings, /hasTranslateConsent\(\)/);
  assert.match(settings, /Traduction automatique/);
  assert.match(settings, /rememberTranslateConsent\(\);\n\s+\}\n\s+setBusy\(true\)/);
  const boot = read("src/components/app/GoogleTranslateBootstrap.tsx");
  assert.match(boot, /if \(code === "fr" \|\| document\.getElementById\("google-translate-script"\)\) return;/);
  assert.match(boot, /document\.documentElement\.dir = info\.dir/);
  assert.match(read("src/app/layout.tsx"), /<GoogleTranslateBootstrap \/>/);
});

test("version : une mise à jour n'est annoncée que si l'identifiant de build du serveur diffère de celui qui tourne", () => {
  assert.equal(info.statusFor("abc", "abc"), "current");
  assert.equal(info.statusFor("abc", "def"), "available");
  assert.equal(info.statusFor("dev", "def"), "current");
  assert.equal(info.statusFor("abc", "dev"), "current");
  assert.equal(info.statusFor("abc", null), "unknown");
  assert.deepEqual(info.parseLatestBuild({ version: "1.6.0", build: "abc123" }), { version: "1.6.0", build: "abc123" });
  assert.equal(info.parseLatestBuild({ version: "1.6.0" }), null);
  assert.equal(info.parseLatestBuild("x"), null);
  const route = read("src/app/api/app-version/route.ts");
  assert.match(route, /force-dynamic/);
  assert.match(route, /no-store/);
});

test("partage : un lien /installer ouvre une page qui installe la PWA ; les navigateurs de réseaux sociaux sont reconnus", () => {
  assert.match(read("src/components/app/ShareAppSettings.tsx"), /SHARE_PATH = "\/installer"/);
  assert.match(read("src/components/app/ShareAppSettings.tsx"), /navigator\.share/);
  assert.match(read("src/app/installer/page.tsx"), /beforeinstallprompt/);
  const facebook = env.detectInstallEnvironment("Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/430.0]", false);
  assert.equal(facebook.inApp, true);
  assert.equal(facebook.android, true);
  const ipad = env.detectInstallEnvironment("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15", false, 5);
  assert.equal(ipad.ios, true);
  assert.equal(ipad.inApp, false);
  assert.equal(env.chromeIntentUrl({ host: "app.example", pathname: "/installer", search: "" }), "intent://app.example/installer#Intent;scheme=https;package=com.android.chrome;end");
});

test("paramètres : langue, partage et version dans les trois espaces ; la déconnexion globale vit dans Sécurité et connexion", () => {
  const directory = read("src/components/SettingsDirectory.tsx");
  assert.match(directory, /<AppSettingsGroup \/>/);
  assert.doesNotMatch(directory, /Se déconnecter de tous les appareils|onLogoutAll/);
  for (const file of ["AccountSettingsClient", "ProfessionalSettingsClient", "EstablishmentSettingsClient"]) {
    assert.match(read(`src/components/${file}.tsx`), /<LogoutAllSetting/, `${file} : la déconnexion de tous les appareils est dans la modale de sécurité`);
  }
  const group = read("src/components/app/AppSettingsGroup.tsx");
  for (const name of ["LanguageSettings", "ShareAppSettings", "AppVersionSettings"]) assert.match(group, new RegExp(name));
  assert.match(read("src/components/LogoutAllSetting.tsx"), /confirm\(/);
});

test("historique des consultations : une seule carte dans les trois espaces, qui ne déborde pas à droite", () => {
  for (const [file, pattern] of [["PatientConsultations", /<ConsultationCard /], ["ProfessionalConsultations", /<ConsultationCard [^>]*showPatient/], ["EstablishmentPatientRecords", /<ConsultationCard [^>]*sealImages=\{false\}/]]) {
    assert.match(read(`src/components/${file}.tsx`), pattern, `${file} utilise la carte commune`);
  }
  const css = read("src/components/consultation/consultation-card.css");
  assert.match(css, /\.consult-card__badge \{[^}]*white-space: normal/);
  assert.match(css, /\.consult-card__badge \{[^}]*max-width: 100%/);
  assert.match(css, /\.consult-card > \* \{ min-width: 0; \}/);
  assert.match(css, /\.consult-vitals__grid \{[^}]*repeat\(auto-fill, minmax\(min\(100%, 104px\), 1fr\)\)/);
  const card = read("src/components/consultation/ConsultationCard.tsx");
  for (const text of [/Constantes/, /Symptômes/, /Examen clinique/, /Conduite à tenir/, /Ordonnance/, /Examens demandés/, /Validée et signée électroniquement/]) assert.match(card, text);
  assert.match(card, /<SealImages item=\{item\} \/>/);
});

test("validation : sans signature ni cachet, « Terminer et signer » reste fermé ; le professionnel signe (dessin ou photo) sur place", () => {
  const consultations = read("src/components/ProfessionalConsultations.tsx");
  assert.match(consultations, /disabled=\{submitting \|\| !encounterId \|\| !sealReady\}/);
  assert.match(consultations, /if \(!sealReady\) \{ setMessage\("Ajoutez votre signature ou votre cachet/);
  const seal = read("src/components/ConsultationSeal.tsx");
  assert.match(seal, /signature_uploaded \|\| credentials\.stamp_uploaded/);
  assert.match(seal, /<InkCapture kind=\{capturing\}/);
  assert.match(seal, /apiUploadPatch<Credentials>\("\/api\/v1\/professionals\/credentials\/"/);
  assert.match(seal, /onReadyChange\?\.\(ready\)/);
  // Retirer le dernier moyen de signer prévient le professionnel.
  assert.match(read("src/components/ProfessionalCredentialsSettings.tsx"), /lastOne/);
});

test("clôture : la signature ferme l'accès du médecin à la suite de la consultation, et le dit avant de signer", () => {
  const consultations = read("src/components/ProfessionalConsultations.tsx");
  assert.match(consultations, /votre accès à son carnet se fermera automatiquement/);
  assert.match(consultations, /setGrants\(\(current\) => current\.filter\(\(grant\) => grant\.id !== signedGrantId\)\)/);
});
