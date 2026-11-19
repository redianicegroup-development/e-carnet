import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* Lot du 19/11/2026 (2) : tuiles « Profil » partout, onboarding enfant, devis par e-mail, ordre des écrans, landing, correctif proches de confiance.
   Même méthode que les autres tests : on lit les sources et on vérifie ce qui doit y être. */
const root = new URL("../", import.meta.url);
const read = (file) => readFileSync(new URL(file, root), "utf8");
const readApi = (file) => readFileSync(new URL(`../api/${file}`, root), "utf8");

test("Profil : une tuile = photo ronde + nom court ; la fiche (modal) s'ouvre au toucher avec les boutons d'action", () => {
  const profile = read("src/components/ui/Profile.tsx");
  assert.match(profile, /variant = "tile"/, "la tuile est la présentation par défaut");
  assert.match(profile, /className="profile-tile__name"/);
  assert.match(profile, /aria-haspopup="dialog"/);
  assert.match(profile, /\{open && <ProfileSheet \{\.\.\.sheet\} onClose=\{\(\) => setOpen\(false\)\} \/>\}/);
  assert.match(profile, /export function ProfileGrid/);
  const css = read("src/components/ui/profile.css");
  assert.match(css, /\.profile-tiles \{[^}]*display: grid/);
  assert.match(css, /\.profile-tile\[data-selected="true"\]/, "profil choisi : anneau plein");
});

test("rattachements, patients reçus, demandes, laboratoires, proches, enfants : photos seules, actions dans la fiche", () => {
  const access = read("src/components/ProfessionalAccess.tsx");
  assert.match(access, /label: "Définir comme établissement actif", tone: "primary"/);
  assert.match(access, /label: "Mettre fin à mon rattachement", tone: "danger"/);
  assert.doesNotMatch(access, /membership-row|avatar-button/, "plus de ligne de texte avec boutons dans la liste");
  const recent = read("src/components/ProfessionalRecentPatients.tsx");
  assert.match(recent, /<RecentPatientHistory name=\{profile\.name\} \/>/, "l'historique ne se charge qu'à l'ouverture de la fiche");
  assert.doesNotMatch(recent, /recent-patients__list/);
  assert.match(read("src/components/ProfessionalAccessGrants.tsx"), /label: "Terminer l’accès", tone: "danger"/);
  assert.match(read("src/components/EstablishmentLaboratories.tsx"), /label: "Révoquer", tone: "danger"/);
  const trusted = read("src/components/TrustedContactDelegationClient.tsx");
  assert.match(trusted, /label: "Retirer l’accès", tone: "danger"/);
  assert.match(trusted, /<ProfileGrid label="Mes délégations">/);
  assert.match(trusted, /<ProfileGrid label="Carnets de proches">/);
  assert.match(read("src/components/PatientRepresentationsSettingsClient.tsx"), /<ProfileGrid label="Profils d’enfants">/);
  const choice = read("src/components/PatientProfileChoice.tsx");
  assert.match(choice, /<ProfileGrid label="Pour qui est cette consultation \?">/);
});

test("menu de changement de profil : posé dans <body>, position fixe, jamais plus large que l'écran", () => {
  const switcher = read("src/components/PatientProfileSwitcher.tsx");
  assert.match(switcher, /createPortal\(/);
  assert.match(switcher, /window\.visualViewport\?\.width/);
  assert.match(switcher, /Math\.max\(16, Math\.min\(anchor\.left, viewport - width - 16\)\)/, "toujours à 16 px des bords");
  const css = read("src/components/patient-profiles.css");
  assert.match(css, /\.profile-menu \{ position: fixed; z-index: 1250;[^}]*max-width: calc\(100vw - 32px\)/);
});

test("onboarding enfant : photo, prénom, nom, date de naissance, carnet ; modal succès ou échec ; boutons qui ne débordent pas", () => {
  const onboarding = read("src/components/ChildOnboarding.tsx");
  assert.match(onboarding, /<AvatarPicker value=\{photo\}/);
  assert.match(onboarding, /<span>Date de naissance<\/span><input required type="date"/);
  assert.match(onboarding, /avatar_data: photo/);
  assert.match(onboarding, /runAsProfile\(child\.patient_id, \(\) => saveChildIdentity\(form\)\)/);
  assert.match(onboarding, /title: "Profil créé"/);
  assert.match(onboarding, /title: "Profil non créé"/);
  assert.match(onboarding, /title: "Carnet non enregistré"/);
  const css = read("src/components/patient-profiles.css");
  assert.match(css, /\.child-onboarding__actions \{ display: grid; grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(read("src/lib/patient-profiles.ts"), /avatar_url\?: string/);
  // API : la photo est validée (WebP, 250 Ko) avant toute création, puis gardée dans le profil de l'enfant.
  const views = readApi("apps/patients/views.py");
  assert.match(views, /avatar_data = clean_avatar_data\(request\.data\.get\("avatar_data"\)\)/);
  assert.match(views, /store_child_avatar\(patient, avatar_data\)/);
  assert.match(views, /"avatar_url": child_avatar\(patient\)/);
  assert.match(readApi("apps/patients/avatars.py"), /MAX_WEBP_BYTES = 250 \* 1024/);
  assert.match(readApi("apps/patients/migrations/0015_patientprofile_avatar.py"), /name="avatar_data"/);
});

test("Proches de confiance : le verrou FOR UPDATE ne porte pas sur une jointure nullable (500 sur PostgreSQL, « service indisponible »)", () => {
  const views = readApi("apps/patients/delegation_views.py");
  assert.doesNotMatch(views, /select_for_update\(\)/, "toujours of=(\"self\",) quand la requête joint patient__user ou delegate");
  assert.equal((views.match(/select_for_update\(of=\("self",\)\)/g) ?? []).length, 3);
});

test("devis : le bouton de l'offre Institutionnel ouvre un e-mail prérempli vers l'équipe", () => {
  const quote = read("src/lib/quote-request.ts");
  assert.match(quote, /fieldValue\("publisher\.email"\)/);
  assert.match(quote, /mailto:\$\{email\}\?subject=\$\{encodeURIComponent\(subject\)\}&body=\$\{encodeURIComponent\(body\)\}/);
  assert.match(quote, /return "\/#contact"/, "sans adresse renseignée : formulaire de contact de l'accueil");
  assert.match(read("src/components/EstablishmentBilling.tsx"), /quoteRequestHref\(\{ establishmentName: data\.establishment\.name/);
});

test("ordre des écrans : tuiles avant « Mes consultations » (patient et professionnel), KPI avant « Mise en route »", () => {
  const history = read("src/components/PatientHistory.tsx");
  assert.ok(history.indexOf('title="Mes vaccins"') < history.indexOf('title="Mes consultations"'));
  assert.ok(history.indexOf('title="Accès à mes données"') < history.indexOf('title="Mes consultations"'));
  const pro = read("src/components/ProfessionalConsultations.tsx");
  assert.ok(pro.indexOf('title="Mode invité"') < pro.indexOf("{tiles}") && pro.indexOf("{tiles}") < pro.indexOf('title="Mes consultations" alwaysOpen'));
  const home = read("src/components/PatientHome.tsx");
  assert.ok(home.indexOf("<PatientKpis") < home.indexOf("<SetupCard"));
});

test("landing : plus de bouton « Commencer », le texte du CTA final et un header sans fond", () => {
  const content = read("src/lib/landing-content.ts");
  assert.doesNotMatch(content, /"Commencer"/);
  assert.equal((content.match(/S’inscrire gratuitement/g) ?? []).length >= 2, true, "héro et carte Patients");
  assert.match(content, /title: "Ne perdez plus le fil de vos antécédents médicaux\."/);
  assert.match(content, /lead: "Centralisez vos informations de santé et gardez une trace de votre parcours médical\."/);
  assert.doesNotMatch(read("src/app/site-pages.css"), /\.pub-header::before/);
});
