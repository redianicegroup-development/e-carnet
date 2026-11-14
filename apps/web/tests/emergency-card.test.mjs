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

test("les réglages portent la carte virtuelle (sans QR) et la carte professionnelle ; l’accueil n’en affiche plus", () => {
  const settings = read("src/components/PatientEmergencyCardSettingsClient.tsx");
  const image = read("src/components/emergency-card/emergency-card-image.ts");
  const visual = read("src/components/emergency-card/EmergencyCardVisual.tsx");
  const account = read("src/components/AccountSettingsClient.tsx");
  const home = read("src/components/PatientHomeIdentity.tsx");
  assert.match(settings, /<EmergencyCardVisual card=\{shown\} showQr=\{false\} photo=\{photo\} \/>/);
  assert.match(settings, /downloadEmergencyCardPng\(shown, photo\)/);
  assert.match(settings, /Télécharger en PNG/);
  // « Ma carte virtuelle » ne porte plus qu'un lien : ville, contact et le reste se modifient dans les déclarations du carnet
  assert.match(settings, /"\/patient\/carnet#carte-urgence"/);
  assert.match(settings, /"Modifier ma carte"/);
  assert.doesNotMatch(settings, /city: city|setCity|setContactName|setContactPhone|<input/);
  // Le QR public ne fait plus partie de l’accordéon de la carte : ni renouvellement ni panneau QR local.
  assert.doesNotMatch(settings, /Renouveler|rotate|offline|Carte imprimable|<details|ecard-details/i);
  assert.doesNotMatch(read("src/components/emergency-card/emergency-card.css"), /ecard-details|ecard-offline/);
  assert.doesNotMatch(settings, /ecard-qr|qrOpen|qrPanelId/);
  assert.doesNotMatch(settings, /Le QR public de cette carte se gère ici|QR de ma carte|Activer mon QR/);
  assert.match(settings, /QR public encore actif/, "repli : un ancien QR actif reste désactivable");
  // Carte professionnelle : même panneau, même position (sous le profil, avant l'annuaire des réglages), sans QR.
  const professionalSettings = read("src/components/ProfessionalSettingsClient.tsx");
  assert.match(professionalSettings, /<PatientEmergencyCardSettingsClient variant="professional" \/>/);
  assert.ok(professionalSettings.indexOf("<PatientEmergencyCardSettingsClient") < professionalSettings.indexOf("<SettingsDirectory"));
  assert.match(settings, /Ma carte professionnelle/);
  // L’activation et la désactivation du QR stable se font dans Moi (paramètres) : l’accueil patient n’affiche plus la carte.
  assert.doesNotMatch(account, /QRCodeSVG|settings-account-summary__emergency-qr|emergency-card\//);
  assert.doesNotMatch(settings, /QRCodeSVG/, "le QR de la carte virtuelle n'est plus affiché");
  assert.match(read("src/components/emergency-card/useEmergencyCard.ts"), /apiGet<EmergencyCardData>\("\/api\/v1\/patient\/emergency-card\//);
  assert.match(settings, /apiPatch<EmergencyCard>\("\/api\/v1\/patient\/emergency-card\//);
  assert.match(settings, /qr_enabled/);
  assert.match(visual, /Taille déclarée/);
  assert.match(visual, /Poids déclaré/);
  assert.match(home, /home-profile-title/);
  // « Dossier patient » : même présentation que le dossier médecin (nom en titre, informations clés en lignes)
  assert.match(home, /Dossier patient/);
  assert.match(home, /label: "Âge"/);
  assert.match(home, /label: "Genre déclaré"/);
  assert.match(home, /label: "Ville"/);
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
  assert.match(grants, /vos documents \(lecture seule\)/);
  assert.doesNotMatch(settings, /ActiveAccessQr|usePatientAccessQr|access-qr\/|visit-qr/);
  assert.match(home, /<PatientShareQrButton \/>/, "« Partager en QR » génère le QR temporaire de l'étape 2 à chaque clic");
  const share = read("src/components/PatientShareQr.tsx");
  assert.match(share, /access-qr\//);
  assert.match(share, /Partager en QR/);
  assert.match(share, /usePatientAccessQr/, "le QR généré est celui de l'étape 2 (état partagé)");
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
