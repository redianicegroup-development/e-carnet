import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
const read = (file) => readFileSync(path.join(root, file), "utf8");

/* Une seule fiche de personne pour toute l'application (18/11/2026) : la photo ou la ligne « Profil » ouvre une fiche qui ne contient que les
   informations, avec les boutons d'action TOUJOURS en bas. Avant, chaque écran avait la sienne (équipe, laboratoire, patient, accès, profils d'enfants). */

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(tsx|ts|css)$/.test(entry.name) ? [full] : [];
  });
}

test("la fiche : informations dans un corps qui défile, boutons dans un pied toujours visible, « Fermer » en premier", () => {
  const sheet = read("components/ui/ProfileSheet.tsx");
  assert.match(sheet, /<div className="profile-sheet__body">/);
  assert.match(sheet, /<footer className="profile-sheet__actions">/);
  assert.ok(sheet.indexOf("profile-sheet__body") < sheet.indexOf("profile-sheet__actions"), "les actions viennent après les informations");
  assert.match(sheet, /onClick=\{onClose\}>Fermer<\/button>[\s\S]*actions\.map/, "« Fermer » avant les actions propres à la fiche");
  assert.match(sheet, /createPortal\([\s\S]*document\.body/, "rendue dans <body> : jamais coupée par un parent");
  assert.match(sheet, /role="dialog" aria-modal="true" aria-labelledby=\{titleId\}/);
  assert.match(sheet, /useDialogBehavior\(\{ open: true, container: dialog, initialFocus: closeButton, onEscape: onClose \}\)/);
  const css = read("components/ui/profile.css");
  assert.match(css, /\.profile-sheet__body \{[^}]*overflow-y: auto/, "le corps défile");
  assert.match(css, /\.modal-dialog\.profile-sheet \{[^}]*flex-direction: column[^}]*overflow: hidden/, "le pied ne défile pas avec le corps");
  assert.match(css, /\.profile-sheet__actions \{[^}]*border-top/);
});

test("une action peut renvoyer une phrase affichée dans la fiche, fermer la fiche, ou rester désactivée pendant l'appel", () => {
  const sheet = read("components/ui/ProfileSheet.tsx");
  assert.match(sheet, /if \(typeof result === "string"\) setStatus\(result\)/);
  assert.match(sheet, /onClick: \(context: \{ close: \(\) => void \}\)/);
  assert.match(sheet, /disabled=\{pending \|\| action\.disabled\}/);
  assert.match(sheet, /role="status" aria-live="polite"/, "le résultat d'une action est annoncé");
  assert.match(sheet, /danger: "button primary danger"/);
});

test("la fiche passe au-dessus des fenêtres d'action et sous les confirmations qu'elle déclenche", () => {
  const css = read("components/modal/modal.css");
  const z = (selector) => Number(new RegExp(`\\.${selector} \\{[^}]*z-index: (\\d+)`).exec(css)?.[1]);
  assert.ok(z("modal-backdrop--sheet") > z("modal-backdrop--panel"), "au-dessus d'une fenêtre d'action");
  assert.ok(z("modal-backdrop--sheet") < z("modal-backdrop--confirm"), "sous « Révoquer ce lien ? »");
  assert.match(read("components/ui/ProfileSheet.tsx"), /modal-backdrop modal-backdrop--sheet/);
});

test("le déclencheur : photo ronde ou ligne, qui ouvre la fiche", () => {
  const profile = read("components/ui/Profile.tsx");
  assert.match(profile, /variant\?: "photo" \| "row"/);
  assert.match(profile, /className="profile-photo"[\s\S]*aria-label=\{`Voir la fiche de \$\{sheet\.name\}`\}/);
  assert.match(profile, /className="profile-row"/);
  assert.match(profile, /\{open && <ProfileSheet \{\.\.\.sheet\} onClose=\{\(\) => setOpen\(false\)\} \/>\}/);
});

test("tous les écrans utilisent ce composant : équipe, laboratoire, patient reçu, accès, rattachement, profils d'enfants", () => {
  const profile = (file) => read(`components/${file}`);
  assert.match(profile("EstablishmentConsole.tsx"), /<Profile\s+variant="photo"/);
  assert.match(profile("PatientRepresentationsSettingsClient.tsx"), /<Profile\s+variant="row"/);
  for (const file of ["EstablishmentLaboratories.tsx", "EstablishmentPatientRecords.tsx", "ProfessionalPatientDetail.tsx", "ProfessionalGrantDetail.tsx", "ProfessionalMembershipDetail.tsx"]) {
    assert.match(profile(file), /<ProfileSheet\b/, `${file} utilise ProfileSheet`);
  }
});

test("l'ancienne présentation a disparu : plus de modale « profile-modal », de fiche « team-detail » ni de fiche propre aux profils d'enfants", () => {
  assert.equal(existsSync(path.join(root, "components/ui/ProfileDetailModal.tsx")), false);
  const offenders = [];
  for (const file of sourceFiles(root)) {
    // Ce test lui-même et les commentaires d'historique ne comptent pas : on cherche le code et le CSS.
    const text = readFileSync(file, "utf8");
    if (/ProfileDetailModal|profile-modal|team-detail|team-photo|\.profile-detail\b|className="profile-detail"/.test(text)) offenders.push(path.relative(root, file));
  }
  assert.deepEqual(offenders, []);
});

test("les actions qui engagent (révoquer) passent par la confirmation existante, jamais directement depuis la fiche", () => {
  const profiles = read("components/PatientRepresentationsSettingsClient.tsx");
  assert.match(profiles, /async function revoke\(item: PatientProfileEntry\): Promise<boolean>[\s\S]*await confirm\(/, "confirmation avant de révoquer le lien");
  assert.match(profiles, /if \(await revoke\(item\)\) close\(\)/, "la fiche se ferme seulement si le lien est révoqué");
  assert.match(read("components/EstablishmentConsole.tsx"), /<RevocationReasonDialog/, "révocation d'un médecin : motif obligatoire");
  assert.match(read("components/EstablishmentLaboratories.tsx"), /<RevocationReasonDialog/, "révocation d'un administrateur de laboratoire : motif obligatoire");
});

test("la fenêtre « Déclarations à attester » est une fenêtre de travail (PanelDialog), pas une fiche de personne", () => {
  const source = read("components/ProfessionalAttestations.tsx");
  assert.match(source, /<PanelDialog title="Déclarations à attester"/);
  assert.doesNotMatch(source, /ProfileSheet|ProfileDetailModal/);
});
