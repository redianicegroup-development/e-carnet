// Pré-consultation en un bloc, « Mise en route » commune, espace médecin recentré, scanner QR, codes médecin 48 h, photos d'équipe.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), "utf8");
const pre = await import("../src/lib/preconsult.ts");
const spaces = await import("../src/lib/spaces.ts");
const qr = await import("../src/lib/qr-scan.ts");
const codes = await import("../src/lib/join-codes.ts");
const vitals = await import("../src/lib/vitals.ts");

/* ---------- patient : pré-consultation ---------- */
test("vingt symptômes courants sont proposés", () => {
  assert.equal(pre.SYMPTOMS.length, 20);
  assert.equal(new Set(pre.SYMPTOMS).size, 20);
});

test("les symptômes cochés et le texte libre font l'aller-retour dans « observations »", () => {
  const text = pre.buildObservations({ selected: ["Toux", "Fièvre"], other: "douleur au genou depuis lundi" });
  assert.equal(text, "Symptômes : Fièvre, Toux\nAutres : douleur au genou depuis lundi");
  assert.deepEqual(pre.parseObservations(text), { selected: ["Fièvre", "Toux"], other: "douleur au genou depuis lundi" });
  assert.equal(pre.buildObservations({ selected: [], other: "  " }), "");
  assert.equal(pre.buildObservations({ selected: [], other: "mal partout" }), "mal partout");
});

test("un ancien brouillon (texte seul) reste lisible et un symptôme retiré de la liste n'est jamais perdu", () => {
  assert.deepEqual(pre.parseObservations("Fièvre depuis deux jours"), { selected: [], other: "Fièvre depuis deux jours" });
  assert.deepEqual(pre.parseObservations(""), { selected: [], other: "" });
  assert.deepEqual(pre.parseObservations(null), { selected: [], other: "" });
  const parsed = pre.parseObservations("Symptômes : Toux, Hoquet ancien\nAutres : x");
  assert.deepEqual(parsed.selected, ["Toux"]);
  assert.match(parsed.other, /Hoquet ancien/);
  assert.match(parsed.other, /x/);
});

test("poids, taille et température se choisissent dans une liste ; le reste reste libre", () => {
  for (const key of ["weight_kg", "height_cm", "temperature_c"]) assert.equal(pre.isListed(key), true);
  for (const key of ["blood_pressure", "heart_rate", "spo2", "glycemia"]) assert.equal(pre.isListed(key), false);
  const temperature = pre.numberOptions("temperature_c");
  assert.equal(temperature[0].value, "34.0");
  assert.equal(temperature.at(-1).value, "42.0");
  assert.equal(temperature.find((option) => option.value === "38.5").label, "38,5");
  assert.equal(pre.numberOptions("weight_kg").length, 200);
  assert.deepEqual(pre.numberOptions("blood_pressure"), []);
  // une valeur déjà enregistrée hors liste est conservée, au bon rang
  const kept = pre.numberOptions("weight_kg", "61,5");
  assert.equal(kept.length, 201);
  assert.ok(kept.some((option) => option.value === "61.5"));
  // chaque valeur de la liste est acceptée par la validation existante
  for (const key of ["weight_kg", "height_cm", "temperature_c"]) {
    for (const option of pre.numberOptions(key)) assert.equal(vitals.parseVitalsForm({ ...vitals.emptyVitalsForm(), [key]: option.value }).ok, true, `${key} ${option.value}`);
  }
});

test("la pré-consultation est un seul bloc à sections, sans étapes", () => {
  const source = read("src/components/PatientPreconsultations.tsx");
  assert.doesNotMatch(source, /QUESTIONS|Étape \d sur|setStep|preconsult-wizard__skip|Passer cette question/);
  for (const text of [/Quel est le motif de la consultation/, /Quels symptômes ou maux/, /Quelles constantes ont été relevées/, /Qui remplit avec le patient/, /symptom-chip/, /Autre symptôme/, /<select value=\{form\.vitals\[field\.key\]\}/]) assert.match(source, text);
  assert.equal((source.match(/type="submit"/g) ?? []).length, 1, "un seul bouton d'enregistrement");
  assert.match(source, /buildObservations/);
  assert.match(source, /parseObservations/);
});

/* ---------- patient : accueil ---------- */
test("« Mise en route » passe avant le dossier patient et disparaît une fois le carnet commencé", () => {
  const home = read("src/components/PatientHome.tsx");
  assert.ok(home.indexOf("<SetupCard") > -1 && home.indexOf("<SetupCard") < home.indexOf("<PatientHomeIdentity"), "la mise en route est avant le dossier patient");
  assert.ok(home.indexOf("<SetupCard") < home.indexOf("<section className=\"card cta-card\">"));
  const card = read("src/components/SetupCard.tsx");
  assert.match(card, /done === steps\.length\) return null/);
  assert.match(card, /Mise en route/);
});

/* ---------- médecin ---------- */
test("un médecin sans rattachement actif ne voit que l'accueil et le rattachement", () => {
  const ids = (list) => list.map((tab) => tab.id);
  assert.deepEqual(ids(spaces.visibleTabsFor("professional", false)), ["home", "acces"]);
  assert.deepEqual(ids(spaces.visibleTabsFor("professional", true)), ["home", "patients", "consultations", "acces", "moi"]);
  assert.deepEqual(ids(spaces.visibleTabsFor("patient", false)), ["home", "carnet", "consultations", "acces"]);
  assert.deepEqual(ids(spaces.visibleTabsFor("establishment", false)), ["home", "equipe", "demandes", "parametres"]);
  assert.equal(spaces.SPACES.professional.tabs.find((tab) => tab.id === "acces").label, "Rattachement");
  const shell = read("src/components/shell/SpaceShell.tsx");
  assert.match(shell, /\/api\/v1\/professionals\/me\//);
  assert.match(shell, /ecarnet:professional-updated/);
});

test("l'accueil médecin : Mise en route comme le patient, dossier médecin, plus de carte « Prêt »", () => {
  const home = read("src/components/ProfessionalHome.tsx");
  assert.match(home, /<SetupCard/);
  assert.match(home, /<ProfessionalDossier/);
  assert.doesNotMatch(home, /"Prêt"|Votre prochaine étape/);
  const dossier = read("src/components/ProfessionalDossier.tsx");
  for (const text of [/Dossier médecin/, /Spécialité/, /Identifiant professionnel/, /Cachet/, /Signature/, /Établissement actif/]) assert.match(dossier, text);
});

test("le médecin n'arrive jamais dans l'espace établissement et modifie son profil depuis ses paramètres", () => {
  const settings = read("src/components/ProfessionalSettingsClient.tsx");
  assert.doesNotMatch(settings, /Paramètres établissement|\/etablissement\//);
  assert.match(settings, /Modifier mon profil/);
  assert.match(settings, /\/professionnel\/onboarding\?retour=parametres/);
  assert.doesNotMatch(read("src/components/ProfessionalAccess.tsx"), /Modifier mon profil/);
  assert.doesNotMatch(read("src/components/ProfessionalHome.tsx"), /\/etablissement/);
  assert.match(read("src/components/ProfessionalOnboarding.tsx"), /returnTo \?\? \(step3 \? "\/professionnel\/onboarding\/ordonnance\?etape=3" : "\/professionnel\/onboarding\/ordonnance"\)/);
  assert.match(read("src/app/professionnel/onboarding/page.tsx"), /retour === "parametres"/);
});

test("Mes consultations, Vaccinations à confirmer et Mes rattachements sont pliables ; les logos des établissements s'affichent", () => {
  assert.match(read("src/components/ProfessionalConsultations.tsx"), /<CollapsibleSection title="Mes consultations"/);
  assert.match(read("src/app/professionnel/consultations/page.tsx"), /<CollapsibleSection title="Vaccinations à confirmer"/);
  const access = read("src/components/ProfessionalAccess.tsx");
  assert.match(access, /<CollapsibleSection title="Mes rattachements"/);
  assert.match(access, /<EstablishmentLogo logo=\{membership\.establishment_logo\}/);
  assert.match(read("src/components/EstablishmentLogo.tsx"), /Logo de \$\{name\}/);
});

test("le scanner QR démarre : la vidéo existe dès l'ouverture, plus de champ « jeton »", () => {
  const grants = read("src/components/ProfessionalAccessGrants.tsx");
  assert.doesNotMatch(grants, /collez|Scannez ou collez|videoRef|BrowserMultiFormatReader/);
  assert.match(grants, /<QrScanner onResult=\{onScanned\}/);
  assert.doesNotMatch(grants, /<input[^>]*value=\{qrToken\}/);
  const scanner = read("src/components/QrScanner.tsx");
  assert.match(scanner, /<video ref=\{videoRef\}[^>]*playsInline/);
  assert.match(scanner, /decodeFromConstraints/);
  assert.match(scanner, /facingMode: \{ ideal: "environment" \}/);
  assert.match(scanner, /controls\?\.stop\(\)/, "la caméra est arrêtée en quittant le lecteur");
  assert.match(scanner, /Photographier le QR/);
});

test("les erreurs de caméra sont expliquées clairement", () => {
  assert.equal(qr.classifyCameraError({ name: "NotAllowedError" }, true), "denied");
  assert.equal(qr.classifyCameraError({ name: "NotFoundError" }, true), "no-camera");
  assert.equal(qr.classifyCameraError({ name: "NotReadableError" }, true), "busy");
  assert.equal(qr.classifyCameraError({ name: "NotAllowedError" }, false), "insecure");
  assert.equal(qr.classifyCameraError(new Error("?"), true), "unknown");
  assert.match(qr.CAMERA_MESSAGES.denied, /Autorisez la caméra/);
  assert.equal(qr.hasCameraSupport({ mediaDevices: { getUserMedia() {} } }), true);
  assert.equal(qr.hasCameraSupport({}), false);
  assert.equal(qr.hasCameraSupport(undefined), false);
  assert.equal(qr.cleanScannedToken("  abc\n def "), "abcdef");
});

/* ---------- établissement ---------- */
test("les codes médecin restent affichés 48 h puis disparaissent", () => {
  const now = Date.parse("2026-10-22T10:00:00Z");
  assert.equal(codes.expiryLabel("2026-10-24T09:00:00Z", now), "Expire dans 47 h");
  assert.equal(codes.expiryLabel("2026-10-22T10:30:00Z", now), "Expire dans moins d’une heure");
  assert.equal(codes.expiryLabel("2026-10-22T09:59:00Z", now), "");
  const list = codes.usableCodes([
    { id: "old", code: "ECM-OLD", expires_at: "2026-10-22T09:00:00Z" },
    { id: "a", code: "ECM-A", expires_at: "2026-10-24T08:00:00Z", created_at: "2026-10-22T08:00:00Z" },
    { id: "b", code: "ECM-B", expires_at: "2026-10-24T09:30:00Z", created_at: "2026-10-22T09:30:00Z" },
    { id: "empty", code: "", expires_at: "2026-10-24T09:30:00Z" },
  ], now);
  assert.deepEqual(list.map((item) => item.id), ["b", "a"]);
  assert.deepEqual(codes.splitFullName("Awa Kone Traoré"), { first_name: "Awa", last_name: "Kone Traoré" });
  assert.deepEqual(codes.splitFullName(undefined), { first_name: "", last_name: "" });
  const card = read("src/components/EstablishmentJoinCodes.tsx");
  assert.match(card, /join-codes\/active\//);
  assert.doesNotMatch(card, /Il n’est affiché qu’une seule fois|Il ne sera plus affiché/);
  assert.match(card, /reste affiché 48 h/);
});

test("la console établissement affiche le code 48 h et la photo des médecins", () => {
  const console_ = read("src/components/EstablishmentConsole.tsx");
  assert.match(console_, /<EstablishmentJoinCodes establishmentId=\{establishment\.id\} active=\{active\} \/>/);
  assert.doesNotMatch(console_, /createCode|qu’une seule fois/);
  assert.equal((console_.match(/<MemberAvatar member=\{item\} \/>/g) ?? []).length, 2, "équipe et demandes");
  assert.match(console_, /professional_avatar_url/);
});

test("le serveur conserve le code chiffré, l'efface à l'usage et expose photo et logo", () => {
  const api = (rel) => readFileSync(new URL(`../api/apps/${rel}`, root), "utf8");
  const views = api("establishments/views.py");
  assert.match(views, /code_encrypted=seal_code\(raw_code\)/);
  assert.match(views, /join_code\.code_encrypted = ""/);
  assert.match(views, /class EstablishmentActiveJoinCodesView/);
  assert.match(views, /professional_avatar_url/);
  assert.match(api("establishments/urls.py"), /join-codes\/active\//);
  assert.match(api("establishments/migrations/0010_joincode_code_encrypted.py"), /AddField/);
  assert.match(api("professionals/serializers.py"), /"establishment_logo": logo_for/);
  assert.ok(existsSync(new URL("../api/apps/establishments/test_join_code_display.py", root)));
});
