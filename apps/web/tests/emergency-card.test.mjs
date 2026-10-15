// Garde-fous : carte d’urgence virtuelle (carte + QR côte à côte, PNG), QR de consultation cantonné à son onglet,
// et règles CSS globales qu’une version a déjà perdues par accident (taille du texte, police des titres, assistants).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url).pathname;
const read = (rel) => readFileSync(`${root}${rel}`, "utf8");

test("la carte d’urgence affiche identité, groupe sanguin, ville, allergies, contact et QR à côté", () => {
  const visual = read("src/components/emergency-card/EmergencyCardVisual.tsx");
  const styles = read("src/components/emergency-card/emergency-card.css");
  for (const label of ["Groupe sanguin", "Ville", "Allergies", "Contact d’urgence"]) assert.match(visual, new RegExp(label));
  assert.match(visual, /emergencyCardFullName\(card\)/);
  assert.match(visual, /<QRCodeSVG value=\{qrUrl\}/);
  // QR à côté des informations, puis sous elles quand le conteneur (et non l’écran) est étroit.
  assert.match(styles, /\.ecard__body \{[^}]*grid-template-columns: minmax\(0, 1fr\) auto/);
  assert.match(styles, /\.ecard-wrap \{ container: ecard \/ inline-size/);
  assert.match(styles, /@container ecard \(max-width: 430px\) \{[^}]*\.ecard__body \{ grid-template-columns: minmax\(0, 1fr\)/);
});

test("les réglages utilisent la carte, l’export PNG sans dépendance et l’édition de la ville", () => {
  const settings = read("src/components/PatientEmergencyCardSettingsClient.tsx");
  const image = read("src/components/emergency-card/emergency-card-image.ts");
  const account = read("src/components/AccountSettingsClient.tsx");
  assert.match(settings, /<EmergencyCardVisual card=\{card\} qrUrl=\{publicUrl\}/);
  assert.match(settings, /downloadEmergencyCardPng\(card, qrCanvas\)/);
  assert.match(settings, /Télécharger en PNG/);
  assert.match(settings, /city: city\.trim\(\)/);
  // le PNG n’est proposé que si le QR est actif, et le QR n’est jamais généré sans lien public
  assert.match(settings, /card\.qr_enabled\s*\?[\s\S]*Télécharger en PNG/);
  assert.match(settings, /\{publicUrl && <QRCodeCanvas/);
  assert.match(image, /canvas\.toBlob|out\.toBlob/);
  assert.match(image, /type: ?"image\/png"|"image\/png"/);
  assert.doesNotMatch(image, /fetch\(/);
  assert.match(account, /<PatientEmergencyCardSettingsClient \/>/);
  // la carte vit dans sa propre section, plus à l’intérieur du résumé du compte
  assert.match(account, /<\/section>\s*<PatientEmergencyCardSettingsClient \/>/);
});

test("la page publique du scan réutilise la même carte et propose d’appeler le contact", () => {
  const pub = read("src/components/PublicEmergencyCard.tsx");
  assert.match(pub, /<EmergencyCardVisual card=\{data\} showQr=\{false\}/);
  assert.match(pub, /href=\{`tel:\$\{phone\}`\}/);
  assert.match(pub, /first_name|EmergencyCardView/);
});

test("le QR de consultation n’est affiché que dans l’onglet Accès, jamais au-dessus des autres pages", () => {
  const shell = read("src/components/shell/SpaceShell.tsx");
  const grants = read("src/components/PatientAccessGrants.tsx");
  const styles = read("src/app/globals.css");
  assert.doesNotMatch(shell, /QRCodeSVG/);
  assert.doesNotMatch(shell, /patient-active-qr/);
  assert.match(shell, /export function usePatientAccessQr/);
  assert.match(grants, /<ActiveAccessQr token=\{qr\.token\}/);
  assert.doesNotMatch(styles, /\.patient-active-qr \{[^}]*position: sticky/);
});

test("le professionnel ne manipule plus d’identifiant patient : seule une référence courte est affichée", () => {
  for (const file of ["src/application/professional-access-grants.ts", "src/components/ProfessionalConsultations.tsx", "src/components/ProfessionalAccessFlow.tsx"]) {
    assert.doesNotMatch(read(file), /patient_id/, `${file} ne doit plus utiliser patient_id`);
  }
  assert.match(read("src/components/ProfessionalAccessFlow.tsx"), /qr_token/);
});

test("les règles globales des réglages d’apparence et des assistants ne disparaissent pas", () => {
  const css = read("src/app/globals.css");
  assert.match(css, /html \{[^}]*font-size: var\(--text-scale, 100%\)/);
  assert.match(css, /h1, h2, h3 \{ font-family: var\(--font-heading, var\(--font-body\)\); \}/);
  assert.match(css, /\.preconsult-wizard \{/);
  assert.match(css, /\.professional-compact-record \{/);
  assert.match(css, /\.consent-decision \{/);
  assert.match(css, /\.space-main \{ min-width: 0;/);
});
