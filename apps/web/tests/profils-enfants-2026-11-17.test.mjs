import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

/* Proches de confiance : « Donner accès » / « Reçu accès » sont des tuiles à contour comme « Tout ce qui s'est passé », et leurs fenêtres
   s'affichent réellement (elles restaient derrière la fenêtre des paramètres). */

test("proches de confiance : la fenêtre d'action passe au-dessus de la fenêtre des paramètres", () => {
  const css = read("components/modal/modal.css");
  const panel = Number(/\.modal-backdrop--panel \{[^}]*z-index: (\d+)/.exec(css)?.[1]);
  const settings = Number(/\.settings-modal-backdrop \{[^}]*z-index: (\d+)/.exec(read("app/globals.css"))?.[1]);
  assert.ok(panel > settings, `la fenêtre d'action (${panel}) doit recouvrir celle des paramètres (${settings})`);
  const dialog = read("components/modal/PanelDialog.tsx");
  assert.match(dialog, /modal-backdrop modal-backdrop--panel/);
  assert.match(dialog, /createPortal/);
  assert.match(read("components/TrustedContactDelegationClient.tsx"), /import \{ PanelDialog \} from "\.\/modal\/PanelDialog"/);
  assert.match(read("components/PatientRepresentationsSettingsClient.tsx"), /import \{ PanelDialog \} from "\.\/modal\/PanelDialog"/);
});

test("proches de confiance : tuiles à contour, pastille ronde, titre en haut et texte en bas", () => {
  const client = read("components/TrustedContactDelegationClient.tsx");
  for (const label of ["Donner accès", "Reçu accès"]) assert.match(client, new RegExp(`<strong>${label}</strong>`));
  assert.match(client, /className="trusted-tile"[^>]*aria-haspopup="dialog"/);
  assert.match(client, /trusted-tile__icon/);
  assert.match(client, /trusted-tile__hint/);
  const css = read("app/globals.css");
  assert.match(css, /\.trusted-tile \{[^}]*border: 1\.5px solid[^}]*border-radius: 28px/);
  assert.match(css, /\.trusted-tile__icon \{[^}]*border-radius: 50%/);
  assert.match(css, /\.trusted-tiles \{[^}]*grid-template-columns: repeat\(2/);
});

/* Profils d'enfants : intégrés au profil patient (étape 2 = carnet de l'enfant, bascule, choix en consultation). */

test("le profil d'un enfant porte la bascule : étiquettes, requêtes serveur et rechargement des pages", () => {
  const lib = read("lib/patient-profiles.ts");
  assert.match(lib, /HOLDER_LABEL = "Compte patient"/);
  assert.match(lib, /CHILD_LABEL = "Compte enfant"/);
  assert.match(lib, /accountLabel = \(active[^)]*\) => \(active \? CHILD_LABEL : HOLDER_LABEL\)/);
  assert.match(lib, /apiPost\("\/api\/v1\/patient\/representations\/active\/", \{ patient_id: patientId \}\)/);
  assert.match(lib, /apiDelete\("\/api\/v1\/patient\/representations\/active\/"\)/);
  assert.match(lib, /dispatchEvent\(new Event\(PROFILE_CHANGED_EVENT\)\)/);
  const shell = read("components/shell/SpaceShell.tsx");
  assert.match(shell, /addEventListener\("ecarnet:patient-profile-changed"/);
  assert.match(shell, /<Fragment key=\{profileTick\}><Fragment key=\{refreshKey\}>\{children\}<\/Fragment><\/Fragment>/, "chaque changement de profil recharge le contenu de la page");
  assert.match(shell, /space === "patient"[^<]*<RepresentedProfileBanner \/>/);
  assert.match(read("components/RepresentedProfileBanner.tsx"), /Compte enfant|CHILD_LABEL/);
  assert.match(read("components/RepresentedProfileBanner.tsx"), /Revenir à mon compte/);
});

test("Paramètres : la flèche de la carte « Compte patient » change de profil, et les rubriques du titulaire se masquent côté enfant", () => {
  const settings = read("components/AccountSettingsClient.tsx");
  assert.match(settings, /eyebrow=\{accountLabel\(active\)\}/);
  assert.match(settings, /eyebrowAction=\{profiles\.length > 0 \? <PatientProfileSwitcher/, "la flèche n'apparaît que s'il existe un profil d'enfant");
  assert.match(settings, /HOLDER_ONLY_SECTIONS = new Set\(\["personnel", "proches", "proches-de-confiance"\]\)/);
  assert.match(settings, /<PatientEmergencyCardSettingsClient key=\{activeChild\?\.patient_id \?\? "holder"\} profile=\{activeChild\} \/>/);
  const switcher = read("components/PatientProfileSwitcher.tsx");
  assert.match(switcher, /aria-label="Changer de profil"/);
  assert.match(switcher, /role="menuitemradio"/);
  assert.match(switcher, /HOLDER_LABEL/);
  assert.match(switcher, /CHILD_LABEL/);
  assert.match(switcher, /useLayoutEffect[\s\S]{0,400}window\.innerWidth/, "le menu reste dans la fenêtre sur un petit écran");
  assert.match(read("components/ProfileSummary.tsx"), /eyebrowAction/);
});

test("« Profils » : liste, fiche (prénom, nom, identifiant, copier, révoquer) et plus de « Ouvrir ce dossier »", () => {
  const settings = read("components/AccountSettingsClient.tsx");
  assert.match(settings, /title: "Profils"/);
  assert.doesNotMatch(settings, /Proches et personnes représentées/);
  const profiles = read("components/PatientRepresentationsSettingsClient.tsx");
  assert.doesNotMatch(profiles, /Ouvrir ce dossier|Revenir à mon dossier/, "l'ouverture d'un dossier passe par la flèche de Paramètres");
  for (const label of ["Prénom", "Nom", "Identifiant"]) assert.match(profiles, new RegExp(`<dt>${label}</dt>`));
  assert.match(profiles, /Copier l’identifiant/);
  assert.match(profiles, /className="button danger"[\s\S]{0,80}Révoquer</);
  assert.match(profiles, /className="profile-row"/);
  assert.match(read("components/patient-profiles.css"), /\.profile-detail \{[^}]*width: 100%/);
});

test("créer un profil enfant : étape 2 = carnet de l'enfant, sans changer le profil ouvert", () => {
  const profiles = read("components/PatientRepresentationsSettingsClient.tsx");
  assert.match(profiles, /Étape 1 sur 2 · Le profil/);
  assert.match(profiles, /Étape 2 sur 2/);
  assert.match(profiles, /Créer le profil et continuer/);
  assert.match(profiles, /runAsProfile\(child\.patient_id, \(\) => saveChildIdentity\(form\)\)/);
  assert.match(profiles, /showProfession=\{false\} showBirthDate=\{false\}/, "la naissance est déjà donnée à l'étape 1, la profession ne concerne pas un enfant");
  const lib = read("lib/patient-profiles.ts");
  const run = lib.slice(lib.indexOf("export async function runAsProfile"));
  assert.match(run, /finally/, "le profil précédent est toujours rétabli, même si l'enregistrement échoue");
  const identity = read("components/PatientIdentityFields.tsx");
  assert.match(identity, /export async function saveChildIdentity/);
  assert.match(identity, /kind: "city"/);
  const start = identity.indexOf("export async function saveChildIdentity");
  const save = identity.slice(start, identity.indexOf("\n}\n", start));
  assert.doesNotMatch(save, /birth_date|profession/, "la naissance et la profession ne sont pas réécrites pour l'enfant");
});

test("consultation et pré-consultation : choix du profil en tête, seulement s'il existe un profil d'enfant", () => {
  assert.match(read("components/PatientConsultationFlow.tsx"), /<PatientProfileChoice \/>/);
  const choice = read("components/PatientProfileChoice.tsx");
  assert.match(choice, /Pour qui est cette consultation \?/);
  assert.match(choice, /aria-pressed=/);
  assert.match(choice, /if \(!ready \|\| usable\.length === 0\) return null/);
  assert.match(choice, /selectProfile/);
});

test("la fiche d'urgence d'un enfant n'emprunte rien au titulaire (pas de photo, pas de profession)", () => {
  const card = read("components/PatientEmergencyCardSettingsClient.tsx");
  assert.match(card, /profile\??:/);
  assert.match(card, /profession[\s\S]{0,120}null|null[\s\S]{0,120}profession/);
});
