// Classe A du plan : PAT-19 (récapitulatif d'accès), PRO-15 (patients récents), PAT-09 (export par période/rubrique),
// PRO-16 (recherche et filtres dans les listes autorisées), PAT-20 (économie de données + pictogrammes).
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), "utf8");
const summary = await import("../src/lib/access-summary.ts");
const recent = await import("../src/lib/recent-patients.ts");
const exporter = await import("../src/lib/carnet-export.ts");
const filter = await import("../src/lib/list-filter.ts");
const saver = await import("../src/lib/data-saver.ts");
const pictograms = await import("../src/lib/pictograms.ts");

// ---------------------------------------------------------------------------------------------------------------- PAT-19

test("PAT-19 : trois choix, « désactivé » en premier, et une valeur inconnue du serveur ne casse rien", () => {
  assert.deepEqual(summary.SUMMARY_CHOICES.map((choice) => choice.value), ["disabled", "weekly", "monthly"]);
  assert.equal(summary.isSummaryFrequency("weekly"), true);
  assert.equal(summary.isSummaryFrequency("daily"), false);
  assert.equal(summary.isSummaryFrequency(["weekly"]), false);
  assert.equal(summary.summaryLabel("monthly"), "Chaque mois");
});

test("PAT-19 : le dernier envoi est décrit sans inventer de date", () => {
  assert.equal(summary.describeLastSent(null), "Aucun récapitulatif envoyé pour le moment.");
  assert.match(summary.describeLastSent("2026-11-08T08:00:00Z"), /^Dernier envoi : /);
});

test("PAT-19 : la page des paramètres expose la rubrique et le composant dit honnêtement où arrive le résumé", () => {
  const settings = read("src/components/AccountSettingsClient.tsx");
  assert.match(settings, /id: "recapitulatif-acces", title: "Récapitulatif des accès"/);
  assert.match(settings, /<PatientAccessSummarySettings \/>/);
  const component = read("src/components/PatientAccessSummarySettings.tsx");
  assert.match(component, /notifications/i);
  assert.match(component, /aria-live/);
  assert.doesNotMatch(component, /localStorage|sessionStorage/, "le choix est enregistré côté serveur, pas dans le navigateur");
});

// ---------------------------------------------------------------------------------------------------------------- PRO-15

test("PRO-15 : seuls prénom, nom et date survivent à la lecture (un identifiant glissé par erreur est écarté)", () => {
  const rows = recent.parseRecentPatients([
    { first_name: "Awa", last_name: "Kouassi", last_accessed_at: "2026-11-10T10:00:00Z", id: "secret-id", patient_id: "p-1", diagnosis: "privé" },
    { first_name: "Sans date", last_name: "Ignoré" },
    null,
    "texte",
  ]);
  assert.deepEqual(rows, [{ first_name: "Awa", last_name: "Kouassi", last_accessed_at: "2026-11-10T10:00:00Z" }]);
  assert.deepEqual(Object.keys(rows[0]).sort(), ["first_name", "last_accessed_at", "last_name"]);
  assert.deepEqual(recent.parseRecentPatients({ data: [] }), []);
});

test("PRO-15 : 20 lignes au plus, 30 jours de conservation, recherche seulement au-delà de 5 lignes", () => {
  const many = Array.from({ length: 30 }, (_, index) => ({ first_name: "P", last_name: String(index), last_accessed_at: "2026-11-10T10:00:00Z" }));
  assert.equal(recent.parseRecentPatients(many).length, 20);
  assert.equal(recent.RECENT_LIMIT, 20);
  assert.equal(recent.RECENT_RETENTION_DAYS, 30);
  assert.equal(recent.RECENT_SEARCH_FROM, 6);
  assert.equal(recent.listedUntil("2026-11-10T00:00:00.000Z"), "2026-12-10T00:00:00.000Z");
  assert.equal(recent.listedUntil("pas une date"), null);
  assert.equal(recent.recentPatientName({ first_name: " Awa ", last_name: "Kouassi" }), "Awa Kouassi");
  assert.equal(recent.recentPatientName({ first_name: "", last_name: "" }), "Patient sans nom renseigné");
});

test("PRO-15 : le composant n'ouvre jamais un dossier — une seule action, la nouvelle demande par QR", () => {
  const component = read("src/components/ProfessionalRecentPatients.tsx");
  assert.match(component, /Nouvelle demande par QR/);
  assert.match(component, /href="#scanner"/);
  assert.match(component, /Aucun patient reçu ces/);
  assert.match(component, /ne se rouvre pas/);
  assert.doesNotMatch(component, /patient_id|access_grant|\/access-grants\/|router\.push|<Link/, "aucun lien vers un dossier ni identifiant");
  assert.doesNotMatch(component, /localStorage|sessionStorage|indexedDB/, "aucune copie de la liste dans le navigateur");
  const page = read("src/app/professionnel/patients/page.tsx");
  assert.ok(page.indexOf("<ProfessionalRecentPatients />") < page.indexOf("<ProfessionalAccessGrants />"), "la liste est au-dessus des demandes");
  assert.match(page, /<ClinicalGate>/, "toujours derrière la porte clinique");
});

// ---------------------------------------------------------------------------------------------------------------- PAT-09

test("PAT-09 : PDF et Excel reçoivent les mêmes paramètres ; tout coché = export complet sans « sections »", () => {
  const all = exporter.buildExportUrl({ format: "xlsx", from: "", to: "", sections: [...exporter.ALL_SECTION_KEYS] });
  assert.equal(all, "/api/v1/patient/care/export/?format=xlsx");
  const pdf = exporter.buildExportUrl({ format: "pdf", from: "2026-01-01", to: "2026-06-30", sections: ["vaccins", "consultations"] });
  const xlsx = exporter.buildExportUrl({ format: "xlsx", from: "2026-01-01", to: "2026-06-30", sections: ["vaccins", "consultations"] });
  assert.equal(pdf, "/api/v1/patient/care/export/?format=pdf&from=2026-01-01&to=2026-06-30&sections=vaccins%2Cconsultations");
  assert.equal(xlsx.replace("format=xlsx", "format=pdf"), pdf);
});

test("PAT-09 : aucune rubrique, rubrique inconnue ou période invalide = pas de téléchargement", () => {
  assert.equal(exporter.buildExportUrl({ format: "pdf", from: "", to: "", sections: [] }), null);
  assert.equal(exporter.buildExportUrl({ format: "pdf", from: "", to: "", sections: ["secrets"] }), null);
  assert.equal(exporter.buildExportUrl({ format: "pdf", from: "2026-07-01", to: "2026-06-01", sections: ["vaccins"] }), null);
  assert.equal(exporter.buildExportUrl({ format: "pdf", from: "1850-01-01", to: "", sections: ["vaccins"] }), null);
  assert.equal(exporter.buildExportUrl({ format: "pdf", from: "2026-02-30", to: "", sections: ["vaccins"] }), null);
  assert.equal(exporter.periodProblem("2026-07-01", "2026-06-01"), "La date de fin doit suivre la date de début.");
  assert.equal(exporter.periodProblem("", ""), null);
  assert.deepEqual(exporter.normalizeSections(["examens", "vaccins", "inconnu", "vaccins"]), ["vaccins", "examens"]);
});

test("PAT-09 : les sept rubriques du web sont exactement celles du serveur, dans le même ordre", () => {
  const server = read("../api/apps/care/export_filters.py").match(/SECTION_KEYS = \(([^)]*)\)/)[1].match(/"([a-z]+)"/g).map((item) => item.replaceAll('"', ""));
  assert.deepEqual([...exporter.ALL_SECTION_KEYS], server);
  assert.equal(exporter.EXPORT_SECTIONS.length, 7);
});

test("PAT-09 : la période et les rubriques sont lues avant le téléchargement", () => {
  assert.equal(exporter.describeExportPeriod("", ""), "Tout l’historique");
  assert.equal(exporter.describeExportPeriod("2026-03-01", "2026-06-30"), "Du 01/03/2026 au 30/06/2026");
  assert.equal(exporter.describeExportSections([...exporter.ALL_SECTION_KEYS]), "Toutes les rubriques");
  assert.equal(exporter.describeExportSections(["vaccins", "mesures"]), "Vaccinations, Mesures");
});

test("PAT-09 : l'avertissement « non chiffré » bloque les DEUX boutons, et le PDF reçoit lui aussi la période", () => {
  const component = read("src/components/PatientCarnetExport.tsx");
  assert.match(component, /n’est pas chiffré/);
  assert.match(component, /J’ai compris/);
  assert.match(component, /const ready = understood && Boolean\(pdfUrl\) && Boolean\(xlsxUrl\)/);
  assert.match(component, /format: "pdf", from, to, sections/);
  assert.match(component, /Télécharger en PDF/);
  assert.match(component, /Télécharger en Excel/);
  assert.match(component, /Cochez au moins une rubrique/);
});

// ---------------------------------------------------------------------------------------------------------------- PRO-16

test("PRO-16 : « Hélène » et « helene » se retrouvent, la casse et les espaces ne comptent pas", () => {
  assert.equal(filter.normalizeForSearch("  Hélène   Ouattara "), "helene ouattara");
  assert.equal(filter.normalizeForSearch("Cœur"), "coeur");
  assert.equal(filter.matchesQuery(["Hélène Ouattara", "Clinique du Plateau"], "helene"), true);
  assert.equal(filter.matchesQuery(["Hélène Ouattara"], "HÉLÈNE"), true);
  assert.equal(filter.matchesQuery(["Hélène Ouattara", "Clinique du Plateau"], "ouattara plateau"), true, "tous les mots, dans n'importe quel ordre");
});

test("PRO-16 : filtre vide = tout passe ; aucun résultat = liste vide, jamais une erreur", () => {
  const rows = [["Awa Kouassi"], ["Binta Traoré"], [null, undefined]];
  assert.equal(rows.filter((row) => filter.matchesQuery(row, "")).length, 3);
  assert.equal(rows.filter((row) => filter.matchesQuery(row, "   ")).length, 3);
  assert.equal(rows.filter((row) => filter.matchesQuery(row, "zzz")).length, 0);
  assert.equal(filter.hasActiveFilter(filter.EMPTY_FILTERS), false);
  assert.equal(filter.hasActiveFilter({ ...filter.EMPTY_FILTERS, query: "awa" }), true);
  assert.equal(filter.hasActiveFilter({ ...filter.EMPTY_FILTERS, period: "30d" }), true);
});

test("PRO-16 : filtre de période et d'établissement sur des lignes déjà chargées", () => {
  const now = new Date("2026-11-12T12:00:00Z");
  assert.equal(filter.withinPeriod("2026-11-10T09:00:00Z", "7d", now), true);
  assert.equal(filter.withinPeriod("2026-10-01T09:00:00Z", "7d", now), false);
  assert.equal(filter.withinPeriod("2026-10-20T09:00:00Z", "30d", now), true);
  assert.equal(filter.withinPeriod("2020-01-01T00:00:00Z", "all", now), true);
  assert.equal(filter.withinPeriod(null, "7d", now), false);
  assert.equal(filter.withinPeriod("pas une date", "30d", now), false);
  assert.deepEqual(filter.distinctOptions(["Clinique Plateau", "clinique plateau", "Hôpital Cocody", "", null]), ["Clinique Plateau", "Hôpital Cocody"]);
  assert.equal(filter.sameOption("Hôpital Cocody", "hopital cocody"), true);
});

test("PRO-16 : le raccourci « / » ne vole jamais la saisie et n'existe que sur grand écran ; le nombre de résultats est annoncé", () => {
  assert.equal(filter.isSearchShortcut({ key: "/" }, false, true), true);
  assert.equal(filter.isSearchShortcut({ key: "/" }, true, true), false, "pendant une saisie");
  assert.equal(filter.isSearchShortcut({ key: "/" }, false, false), false, "sur mobile");
  assert.equal(filter.isSearchShortcut({ key: "/", ctrlKey: true }, false, true), false);
  assert.equal(filter.isSearchShortcut({ key: "a" }, false, true), false);
  assert.equal(filter.resultsAnnouncement(0, 0, false), "Aucun élément dans cette liste.");
  assert.equal(filter.resultsAnnouncement(3, 3, false), "3 éléments affichés.");
  assert.equal(filter.resultsAnnouncement(0, 5, true), "Aucun résultat pour cette recherche.");
  assert.equal(filter.resultsAnnouncement(1, 5, true), "1 résultat sur 5.");
  assert.equal(filter.resultsAnnouncement(2, 5, true), "2 résultats sur 5.");
});

test("PRO-16 : la barre de recherche est appliquée aux listes autorisées, sans aucune recherche globale de patients", () => {
  for (const file of ["ProfessionalConsultations", "ProfessionalAgenda", "ProfessionalReferralsClient", "ProfessionalRecentPatients"]) {
    const source = read(`src/components/${file}.tsx`);
    assert.match(source, /ListSearchBar/, `${file} utilise la barre partagée`);
  }
  const bar = read("src/components/list/ListSearchBar.tsx");
  assert.doesNotMatch(bar, /apiGet|apiPost|fetch\(/, "la barre ne lance aucun appel réseau");
  const lib = read("src/lib/list-filter.ts");
  assert.doesNotMatch(lib, /fetch|apiGet|apiPost|XMLHttpRequest/);
  // Aucune route de recherche de patient n'est appelée depuis les composants du professionnel.
  const walk = (dir) => readdirSync(dir).flatMap((name) => { const full = `${dir}/${name}`; return statSync(full).isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(name) ? [full] : []; });
  const offenders = walk(new URL("src", root).pathname).filter((file) => /patients\/search|patient-search|search-patients|\/patients\/\?q=/.test(readFileSync(file, "utf8")));
  assert.deepEqual(offenders, []);
  // Le champ de recherche de la liste des consultations garde son raccourci et ses libellés.
  const consultations = read("src/components/ProfessionalConsultations.tsx");
  assert.match(consultations, /shortcut/);
  assert.match(consultations, /Rechercher patient, établissement ou motif/);
  assert.match(consultations, /Aucune consultation ne correspond à cette recherche ou à ces filtres/);
});

// ---------------------------------------------------------------------------------------------------------------- PAT-20

test("PAT-20 : automatique = Save-Data ou réseau 3G et moins ; « toujours » et « jamais » l'emportent", () => {
  assert.equal(saver.isDataSaverActive("auto", { saveData: true }), true);
  assert.equal(saver.isDataSaverActive("auto", { effectiveType: "2g" }), true);
  assert.equal(saver.isDataSaverActive("auto", { effectiveType: "slow-2g" }), true);
  assert.equal(saver.isDataSaverActive("auto", { effectiveType: "3g" }), true);
  assert.equal(saver.isDataSaverActive("auto", { effectiveType: "4g" }), false);
  assert.equal(saver.isDataSaverActive("auto", {}), false);
  assert.equal(saver.isDataSaverActive("auto", undefined), false, "navigateur sans information de connexion (Safari, Firefox)");
  assert.equal(saver.isDataSaverActive("always", { effectiveType: "4g" }), true);
  assert.equal(saver.isDataSaverActive("never", { saveData: true, effectiveType: "2g" }), false);
});

test("PAT-20 : le réglage est relu avec prudence et la raison du mode est dite en une phrase", () => {
  assert.equal(saver.parseDataSaverSetting("always"), "always");
  assert.equal(saver.parseDataSaverSetting("n'importe quoi"), "auto");
  assert.equal(saver.parseDataSaverSetting(null), "auto");
  assert.deepEqual(saver.DATA_SAVER_CHOICES.map((choice) => choice.value), ["auto", "always", "never"]);
  assert.equal(saver.dataSaverReason("never", { saveData: true }), "");
  assert.equal(saver.dataSaverReason("always", {}), "Vous l’avez activé.");
  assert.equal(saver.dataSaverReason("auto", { saveData: true }), "Votre téléphone demande d’économiser les données.");
  assert.equal(saver.dataSaverReason("auto", { effectiveType: "2g" }), "Votre réseau est lent.");
  const { setting, info } = saver.decodeSnapshot(saver.encodeSnapshot("always", { saveData: true, effectiveType: "3g" }));
  assert.equal(setting, "always");
  assert.deepEqual(info, { saveData: true, effectiveType: "3g" });
  assert.equal(saver.decodeSnapshot(saver.SERVER_SNAPSHOT).setting, "auto", "rendu serveur : jamais actif");
});

test("PAT-20 : photos plus légères en économie de données, mode normal strictement inchangé", () => {
  assert.deepEqual(saver.imageProfile(false), { maxSide: 1600, quality: 0.82 });
  assert.deepEqual(saver.imageProfile(true), { maxSide: 1024, quality: 0.7 });
  assert.ok(saver.IMAGE_PROFILE_SAVER.maxSide < saver.IMAGE_PROFILE_NORMAL.maxSide);
  assert.ok(saver.IMAGE_PROFILE_SAVER.quality < saver.IMAGE_PROFILE_NORMAL.quality);
  const documents = read("src/components/MedicalDocuments.tsx");
  assert.match(documents, /profile: ImageProfile = \{ maxSide: 1800, quality: 0\.8 \}/, "profil d'origine conservé par défaut");
  assert.match(documents, /saver\.active \? IMAGE_PROFILE_SAVER : undefined/);
  assert.match(read("src/components/Vaccinations.tsx"), /saver\.active \? IMAGE_PROFILE_SAVER : undefined/);
});

test("PAT-20 : courbes à la demande, bandeau explicite, réglage dans les paramètres du patient", () => {
  const measurements = read("src/components/HealthMeasurements.tsx");
  assert.match(measurements, /dynamic\(\(\) => import\("\.\/MeasurementTrends"\)/);
  assert.match(measurements, /saver\.active && !trendsRequested/);
  assert.match(measurements, /Afficher les courbes/);
  assert.equal(saver.DATA_SAVER_SLOW_TITLE, "Mauvaise connexion, mode économie activé");
  assert.equal(saver.dataSaverBannerTitle("auto", { effectiveType: "2g" }), saver.DATA_SAVER_SLOW_TITLE, "réseau lent : message « Mauvaise connexion »");
  assert.equal(saver.dataSaverBannerTitle("auto", { effectiveType: "4g" }), "", "bonne connexion : le mode se désactive tout seul, pas de bandeau");
  assert.equal(saver.dataSaverBannerTitle("always", { effectiveType: "4g" }), saver.DATA_SAVER_ON_TITLE);
  assert.equal(saver.dataSaverBannerTitle("auto", { saveData: true }), saver.DATA_SAVER_ON_TITLE);
  assert.equal(saver.dataSaverBannerTitle("never", { effectiveType: "2g" }), "");
  const banner = read("src/components/data-saver/DataSaverBanner.tsx");
  assert.match(banner, /data-data-saver/);
  assert.match(banner, /name=\{slow \? "signal" : "sliders"\}/, "icône de réseau faible dans le bandeau");
  // Le bandeau et le mode vivent dans la coque commune (patient, professionnel, établissement, laboratoire) et dans l'administration.
  assert.match(read("src/components/shell/SpaceShell.tsx"), /<DataSaverBanner visible=\{!bare\} \/>/);
  assert.match(read("src/app/admin/page.tsx"), /<DataSaverBanner \/>/);
  for (const file of ["AccountSettingsClient", "ProfessionalSettingsClient", "EstablishmentSettingsClient", "AdminSettingsClient"]) {
    const settings = read(`src/components/${file}.tsx`);
    assert.match(settings, /id: "economie-donnees", title: "Économie de données"/, `${file} : réglage Économie de données`);
    assert.match(settings, /<DataSaverSettings \/>/, `${file} : fenêtre du réglage`);
  }
});

test("PAT-20 : l'économie de données ne touche à aucune fonction de sécurité", () => {
  // Ni la logique, ni le hook, ni le bandeau n'importent de module d'authentification, de consentement, de QR ou d'audit.
  for (const file of ["src/lib/data-saver.ts", "src/components/data-saver/useDataSaver.ts", "src/components/data-saver/DataSaverBanner.tsx", "src/components/data-saver/DataSaverSettings.tsx"]) {
    const source = read(file);
    assert.doesNotMatch(source, /from "[^"]*(auth|session|logout|qr-scan|push|join-codes|access|consent)[^"]*"/i, `${file} ne dépend d'aucune fonction de sécurité`);
    assert.doesNotMatch(source, /apiGet|apiPost|apiPatch|fetch\(/, `${file} n'envoie rien au serveur`);
  }
  // Le CSS n'enlève que polices et animations : il ne cache aucun élément.
  const css = read("src/components/data-saver/data-saver.css");
  assert.doesNotMatch(css, /display:\s*none|visibility:\s*hidden|pointer-events/);
  assert.match(css, /animation: none !important/);
  // Aucune page de sécurité ne lit le mode.
  for (const file of ["src/components/AccessQrPanel.tsx", "src/components/PatientAccessGrants.tsx"]) {
    try { assert.doesNotMatch(readFileSync(new URL(file, root), "utf8"), /useDataSaver|data-saver/); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
});

test("PAT-20 : treize pictogrammes en SVG intégré, chacun avec un texte alternatif ; ils accompagnent le texte sans le remplacer", () => {
  assert.equal(pictograms.PICTOGRAM_NAMES.length, 13);
  for (const name of pictograms.PICTOGRAM_NAMES) assert.ok(pictograms.PICTOGRAM_LABELS[name]?.length > 3, `texte alternatif pour ${name}`);
  assert.equal(pictograms.pictogramFor(pictograms.SYMPTOM_PICTOGRAMS, "Fièvre"), "fever");
  assert.equal(pictograms.pictogramFor(pictograms.SYMPTOM_PICTOGRAMS, "Maux d’oreille"), null, "pas de dessin adapté : pas de pictogramme");
  assert.equal(pictograms.pictogramFor(pictograms.SYMPTOM_PICTOGRAMS, "constructor"), null, "propriété héritée ignorée");
  assert.equal(pictograms.pictogramFor(pictograms.MEASUREMENT_PICTOGRAMS, "blood_pressure"), "gauge");
  for (const name of [...Object.values(pictograms.SYMPTOM_PICTOGRAMS), ...Object.values(pictograms.MEASUREMENT_PICTOGRAMS)]) assert.ok(pictograms.PICTOGRAM_NAMES.includes(name), `${name} existe`);
  const component = read("src/components/ui/Pictogram.tsx");
  for (const name of pictograms.PICTOGRAM_NAMES) assert.match(component, new RegExp(`\\b${name}: "M`), `dessin pour ${name}`);
  assert.match(component, /role=\{decorative \? undefined : "img"\}/);
  assert.match(component, /aria-hidden=\{decorative \? true : undefined\}/);
  assert.doesNotMatch(component, /<img|url\(|https?:/, "aucun fichier image à télécharger");
});

test("PAT-20 : le choix du mode reste dans le navigateur, déclaré dans la politique de confidentialité", () => {
  const hook = read("src/components/data-saver/useDataSaver.ts");
  assert.match(hook, /localStorage\.setItem\(DATA_SAVER_KEY, next\)/);
  assert.match(hook, /catch/, "stockage refusé : aucune erreur affichée");
  assert.match(read("src/app/confidentialite/page.tsx"), /Économie de données \(localStorage\)/);
});

test("retouches du 13/11/2026 : logo non traduit, onglet Médecins en évidence, tuile Labo dans Demandes, logo de la structure en avatar", () => {
  for (const file of ["src/components/shell/SpaceShell.tsx", "src/components/shell/AppSidebar.tsx", "src/components/public/PublicHeader.tsx", "src/app/admin/page.tsx", "src/app/staff/layout.tsx"]) {
    assert.match(read(file), /className="notranslate" translate="no">/, `${file} : le logo « Mon E‑Carnet » ne se traduit pas`);
  }
  assert.match(read("src/lib/spaces.ts"), /id: "equipe", label: "Médecins"[^\n]*featured: true/, "3e onglet de l'espace établissement mis en évidence");
  const consoleSource = read("src/components/EstablishmentConsole.tsx");
  assert.equal((consoleSource.match(/title="Laboratoires"/g) ?? []).length, 1, "une seule tuile Laboratoires");
  assert.ok(consoleSource.indexOf('title="Laboratoires"') > consoleSource.indexOf('view === "requests"'), "la tuile Laboratoires est dans la vue Demandes");
  const shell = read("src/components/shell/SpaceShell.tsx");
  assert.match(shell, /organisationSpace = space === "establishment" \|\| space === "laboratory"/);
  assert.match(shell, /avatarUrl: organisation\?\.logo \|\| undefined/, "logo téléversé, jamais la photo Google");
  assert.match(read("src/components/EstablishmentProfileEditor.tsx"), /ecarnet:establishment-updated/);
  assert.match(read("src/components/AccountSettingsClient.tsx"), /Personnalisation de mon compte/);
});

test("retouches du 13/11/2026 : notifications actives par défaut, avec le choix « désactiver » respecté", () => {
  const push = read("src/lib/push.ts");
  assert.match(push, /PUSH_OPT_OUT_KEY/);
  assert.match(push, /export async function pushServerReady/);
  const auto = read("src/components/PushAutoEnable.tsx");
  assert.match(auto, /isPushOptedOut\(\)/, "un refus explicite n'est jamais contourné");
  assert.match(auto, /Notification\.permission === "denied"/, "un navigateur qui bloque n'est jamais relancé");
  assert.match(auto, /pushServerReady\(\)/, "pas de demande de permission si le serveur ne sait pas envoyer");
  assert.match(auto, /wasPushAsked\(\)/, "une seule demande automatique par appareil");
  assert.match(read("src/components/PushNotificationToggle.tsx"), /setPushOptOut\(true\)/);
  assert.match(read("src/components/shell/SpaceShell.tsx"), /<PushAutoEnable \/>/);
});

test("retouches du 13/11/2026 : dossiers de l'établissement en photos, fiche simple puis motif", () => {
  const records = read("src/components/EstablishmentPatientRecords.tsx");
  assert.match(records, /className="patient-grid"/);
  assert.match(records, /<PatientDetail patient=\{detail\}/);
  assert.match(records, /Voir le dossier/);
  assert.match(records, /avatar_url\?: string/);
  assert.match(records, /rowDate\(/, "informations datées, plus récentes en premier");
});
