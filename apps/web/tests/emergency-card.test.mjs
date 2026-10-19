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

test("les réglages gardent l’aperçu privé tandis que l’accueil affiche le QR public", () => {
  const settings = read("src/components/PatientEmergencyCardSettingsClient.tsx");
  const image = read("src/components/emergency-card/emergency-card-image.ts");
  const visual = read("src/components/emergency-card/EmergencyCardVisual.tsx");
  const account = read("src/components/AccountSettingsClient.tsx");
  const home = read("src/components/PatientHomeIdentity.tsx");
  assert.match(settings, /<EmergencyCardVisual card=\{card\} showQr=\{false\} photo=\{photo\} \/>/);
  assert.match(settings, /downloadEmergencyCardPng\(card, photo\)/);
  assert.match(settings, /Télécharger en PNG/);
  // « Ma carte virtuelle » ne porte plus qu'un lien : ville, contact et le reste se modifient dans les déclarations du carnet
  assert.match(settings, /href="\/patient\/carnet#carte-urgence">Modifier ma carte</);
  assert.doesNotMatch(settings, /city: city|setCity|setContactName|setContactPhone|<input/);
  // Le QR public ne fait plus partie de l’accordéon de la carte : ni renouvellement ni panneau QR local.
  assert.doesNotMatch(settings, /Renouveler|rotate|offline|Carte imprimable|<details|ecard-details/i);
  assert.doesNotMatch(read("src/components/emergency-card/emergency-card.css"), /ecard-details|ecard-offline/);
  assert.doesNotMatch(settings, /QRCodeSVG|ecard-qr|qrOpen|qrPanelId|publicUrl/);
  assert.match(settings, /Le QR public de cette carte se trouve sur l’accueil patient/);
  // L’activation et la désactivation du QR stable sont maintenant sur l’accueil patient.
  assert.doesNotMatch(account, /QRCodeSVG|settings-account-summary__emergency-qr|emergency-card\//);
  assert.match(home, /<QRCodeSVG value=\{publicUrl\}/);
  assert.match(home, /apiGet<EmergencyQr>\("\/api\/v1\/patient\/emergency-card\//);
  assert.match(home, /apiPatch<EmergencyQr>\("\/api\/v1\/patient\/emergency-card\//);
  assert.match(home, /qr_enabled/);
  assert.match(visual, /Taille déclarée/);
  assert.match(visual, /Poids déclaré/);
  assert.match(home, /home-profile-title/);
  assert.match(home, /<dt>Prénom<\/dt>/);
  assert.match(home, /<dt>Âge<\/dt>/);
  assert.match(home, /<dt>Genre déclaré<\/dt>/);
  assert.match(home, /<dt>Ville<\/dt>/);
  // le PNG remplace le QR par la photo de profil ou l'avatar (monogramme si l'image est illisible), sans dépendance ni réseau applicatif
  assert.doesNotMatch(image, /qrCanvas|QRCode/);
  assert.match(image, /function loadPhoto/);
  assert.match(image, /crossOrigin = "anonymous"/);
  assert.match(image, /photo\.initials/);
  assert.match(image, /canvas\.toBlob|out\.toBlob/);
  assert.match(image, /type: ?"image\/png"|"image\/png"/);
  assert.doesNotMatch(image, /fetch\(/);
  assert.match(visual, /ecard__photo/);
  assert.match(account, /<PatientEmergencyCardSettingsClient \/>/);
});

test("la page publique du scan réutilise la même carte et propose d’appeler le contact", () => {
  const pub = read("src/components/PublicEmergencyCard.tsx");
  assert.match(pub, /<EmergencyCardVisual card=\{data\} showQr=\{false\}/);
  assert.match(pub, /href=\{`tel:\$\{phone\}`\}/);
  assert.match(pub, /first_name|EmergencyCardView/);
});

test("le QR temporaire de visite reste dans Partage et le compte ne porte aucun lien visit-qr", () => {
  const shell = read("src/components/shell/SpaceShell.tsx");
  const grants = read("src/components/PatientAccessGrants.tsx");
  const settings = read("src/components/AccountSettingsClient.tsx");
  const home = read("src/components/PatientHome.tsx");
  const styles = read("src/app/globals.css");
  assert.doesNotMatch(shell, /QRCodeSVG/);
  assert.doesNotMatch(shell, /patient-active-qr/);
  assert.match(shell, /export function usePatientAccessQr/);
  assert.match(grants, /QRCodeSVG|ActiveAccessQr|access-qr\//);
  assert.match(grants, /id="qr"/);
  assert.match(grants, /documents médicaux .* explicitement demandé et autorisé/);
  assert.doesNotMatch(settings, /ActiveAccessQr|usePatientAccessQr|access-qr\/|visit-qr/);
  assert.match(home, /href: "\/patient\/acces#qr"/);
  assert.doesNotMatch(styles, /settings-account-summary__visit-qr|settings-visit-qr-modal/);
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
