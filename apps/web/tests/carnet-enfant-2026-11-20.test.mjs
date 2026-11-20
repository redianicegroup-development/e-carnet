import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* Lot du 20/11/2026 : grille à 3 profils par ligne, bandeau enfant, paramètres stables, photo et suppression d'un carnet enfant, page des établissements proches,
   guide « Comment ça marche ? » et pages d'information à jour. Même méthode que les autres tests : on lit les sources. */
const root = new URL("../", import.meta.url);
const read = (file) => readFileSync(new URL(file, root), "utf8");
const readApi = (file) => readFileSync(new URL(`../api/${file}`, root), "utf8");

test("grille de profils : au moins 3 par ligne sur mobile, et plus jamais deux profils dans la même case", () => {
  const css = read("src/components/ui/profile.css");
  assert.match(css, /@media \(max-width: 560px\) \{ \.profile-tiles \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  const profile = read("src/components/ui/Profile.tsx");
  assert.match(profile, /Children\.toArray\(children\)/, "les tableaux imbriqués (titulaire + enfants) sont aplatis");
});

test("bandeau « Compte enfant » : plus de texte « chaque accès à ce dossier est journalisé »", () => {
  const banner = read("src/components/RepresentedProfileBanner.tsx");
  assert.doesNotMatch(banner, /journalisé/);
  assert.match(banner, /<strong>\{profileName\(active\)\}<\/strong><\/p>/);
  assert.match(banner, /Revenir à mon compte/);
});

test("paramètres : « Carnet enfant » et « Proches de confiance » restent visibles quand un compte enfant est ouvert", () => {
  const settings = read("src/components/AccountSettingsClient.tsx");
  assert.match(settings, /id: "proches", title: "Carnet enfant"/);
  assert.match(settings, /<SettingsDirectory items=\{sections\}/, "toutes les rubriques, quel que soit le profil ouvert");
  assert.doesNotMatch(settings, /HOLDER_ONLY_SECTIONS/);
  assert.match(settings, /activeChild\.avatar_url \? <img src=\{activeChild\.avatar_url\}|active\.avatar_url \? <img src=\{active\.avatar_url\}/, "la photo de l'enfant s'affiche sur sa carte");
});

test("photo d'un carnet enfant : ajouter, modifier, retirer ; visible partout chez le titulaire", () => {
  const form = read("src/components/ChildPhotoForm.tsx");
  assert.match(form, /apiPatch\(`\/api\/v1\/patient\/representations\/\$\{profile\.id\}\/avatar\/`/);
  assert.match(form, /dispatchEvent\(new Event\(PROFILES_UPDATED_EVENT\)\)/, "toutes les listes se rechargent");
  const settings = read("src/components/PatientRepresentationsSettingsClient.tsx");
  assert.match(settings, /"Modifier la photo" : "Ajouter une photo"/);
  assert.match(read("src/components/PatientProfileSwitcher.tsx"), /profile\.avatar_url \? <img src=\{profile\.avatar_url\}/, "la photo est aussi dans le menu de changement de compte");
  assert.match(read("src/components/PatientProfileChoice.tsx"), /photo=\{profile\.avatar_url\}/);
  const urls = readApi("apps/patients/urls.py");
  assert.match(urls, /representations\/<uuid:pk>\/avatar\//);
  assert.match(readApi("apps/patients/views.py"), /class PatientRepresentationAvatarView/);
});

test("suppression d'un carnet enfant : motif obligatoire, confirmation, résultat en modal ; effacement côté serveur", () => {
  const dialog = read("src/components/DeleteChildProfileDialog.tsx");
  assert.match(dialog, /Autre motif/);
  assert.match(dialog, /<input required type="checkbox"/, "confirmation explicite");
  assert.match(dialog, /title: "Profil supprimé"/);
  assert.match(dialog, /title: "Profil non supprimé"/);
  assert.match(dialog, /\/api\/v1\/patient\/representations\/\$\{profile\.id\}\/delete\//);
  assert.match(read("src/components/PatientRepresentationsSettingsClient.tsx"), /label: "Supprimer le profil", tone: "danger"/);
  const views = readApi("apps/patients/views.py");
  assert.match(views, /class PatientRepresentationDeleteView/);
  assert.match(views, /status="deleted"|representation\.status = "deleted"/);
  const deletion = readApi("apps/patients/child_deletion.py");
  assert.match(deletion, /def clean_deletion_request/);
  assert.match(deletion, /MedicalDocument\.objects\.filter\(patient=patient\)\.delete\(\)/);
  assert.match(deletion, /first_name="", last_name="", phone="", birth_date=None/, "l'identité de l'enfant est vidée");
  assert.match(readApi("apps/patients/models.py"), /\("deleted", "Supprimé"\)/);
  assert.match(readApi("apps/patients/migrations/0016_patientrepresentation_deletion.py"), /deletion_reason/);
});

test("« Établissements proches de moi » : une page par espace, plus de modal", () => {
  for (const space of ["patient", "professionnel", "etablissement", "laboratoire"]) {
    const page = read(`src/app/${space}/parametres/etablissements-proches/page.tsx`);
    assert.match(page, new RegExp(`backHref="/${space}/parametres"`));
  }
  assert.doesNotMatch(read("src/components/AccountSettingsClient.tsx"), /NearbyEstablishments/);
  assert.match(read("src/components/SettingsDirectory.tsx"), /<Link className="setting-item" key=\{item\.id\} href=\{item\.href\}/);
});

test("guide « Comment ça marche ? » : le carnet enfant et les proches de confiance sont expliqués", () => {
  const howto = read("src/lib/howto.ts");
  assert.match(howto, /id: "child", href: "\/patient\/parametres", target: "settings-proches"/);
  assert.match(howto, /id: "trusted", href: "\/patient\/parametres", target: "settings-proches-de-confiance"/);
  assert.match(howto, /Pour qui est cette consultation \?/);
  const added = howto.split("\n").filter((line) => /id: "(child|trusted)"/.test(line)).join("\n");
  assert.equal(added.length > 0 && !/à tout moment/.test(added), true, "règle de la revue juridique : pas de « à tout moment » dans les nouvelles étapes");
});

test("pages d'information à jour : Aide, Proches et enfants, CGU, Confidentialité, Mentions légales", () => {
  const help = read("src/components/help/helpContent.ts");
  for (const question of ["Comment ajouter ou changer la photo de mon enfant ?", "Comment supprimer le carnet d’un enfant ?", "Comment trouver un établissement proche de moi ?"]) assert.ok(help.includes(question), question);
  assert.doesNotMatch(help, /Moi › Profils/, "l'ancien nom de la rubrique n'apparaît plus");
  const page = read("src/app/proches-et-enfants/page.tsx");
  assert.doesNotMatch(page, /Moi → Profils/);
  assert.match(page, /Supprimer le profil/);
  const cgu = read("src/app/cgu/page.tsx");
  assert.match(cgu, /id: "annuaire"/);
  assert.match(cgu, /Carnet enfant\./);
  assert.match(cgu, /OpenStreetMap/);
  const privacy = read("src/app/confidentialite/page.tsx");
  assert.match(privacy, /Profil d’un enfant représenté/);
  assert.match(privacy, /OpenStreetMap \(fonds de carte\)/);
  assert.match(privacy, /Établissements partenaires et « Autour de moi »/);
  assert.match(read("src/app/mentions-legales/page.tsx"), /OpenStreetMap/);
});
