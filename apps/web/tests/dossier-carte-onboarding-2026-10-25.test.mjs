// 25/10 : dossier patient, carte virtuelle du médecin, QR = documents inclus, équipe de l'établissement, onboarding avec logo et Retour / Suivant.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

test("la carte virtuelle du médecin : métier sur la carte, même PNG, sur les accueils patient et professionnel", () => {
  const visual = read("src/components/emergency-card/EmergencyCardVisual.tsx");
  const image = read("src/components/emergency-card/emergency-card-image.ts");
  const panel = read("src/components/emergency-card/VirtualCardPanel.tsx");
  const hook = read("src/components/emergency-card/useEmergencyCard.ts");
  assert.match(visual, /profession\?: EmergencyCardProfession \| null/);
  assert.match(visual, /ecard__role/);
  assert.match(image, /emergencyCardProfessionLabel\(card\.profession\)/);
  assert.match(image, /const W = 1600/, "même largeur de PNG");
  assert.match(image, /Math\.max\(CARD_HEIGHT, /, "la hauteur habituelle est conservée, l’image s’allonge seulement si besoin");
  assert.match(panel, /downloadEmergencyCardPng\(view, photo\)/);
  assert.match(hook, /\/api\/v1\/professionals\/me\//);
  assert.match(hook, /isProfessionalAccount\(account\.contexts\)/, "pas d’appel professionnel pour un patient simple");
  assert.match(read("src/components/PatientHomeIdentity.tsx"), /<VirtualCardPanel /);
  const proHome = read("src/components/ProfessionalHome.tsx");
  assert.match(proHome, /<ProfessionalVirtualCard account=\{account\} profile=\{profile\} \/>/);
  assert.match(proHome, /professional_title/);
});

test("la page publique du QR ne montre jamais le métier", () => {
  const pub = read("src/app/urgence/[token]/page.tsx");
  assert.doesNotMatch(pub, /profession/);
});

test("dossier patient et dossier médecin : une seule présentation commune (DossierCard), les champs du patient restent ceux d'origine", () => {
  const card = read("src/components/DossierCard.tsx");
  const home = read("src/components/PatientHomeIdentity.tsx");
  const doctor = read("src/components/ProfessionalDossier.tsx");
  // même composant, même CSS : photo, nom en titre, lignes d'informations
  assert.match(card, /<AvatarBadge /);
  assert.match(card, /dossier__head/);
  assert.match(card, /<DossierRows /);
  assert.match(home, /<DossierCard/);
  assert.match(doctor, /<DossierCard/);
  assert.match(home, /eyebrow="Dossier patient"/);
  assert.match(doctor, /eyebrow="Dossier médecin"/);
  assert.equal((card.match(/<section /g) ?? []).length, 1);
  assert.doesNotMatch(read("src/components/professional-dossier.css"), /professional-dossier__(head|list)/, "la présentation commune n'est plus dupliquée");
  // les champs du patient ne changent pas : ni profession ni e-mail ajoutés, couverture santé en trois lignes, déclarations avec leur provenance
  for (const label of ["Âge", "Genre déclaré", "Ville", "Téléphone", "Adresse", "Couverture santé · organisme", "Couverture santé · numéro", "Couverture santé · expiration"]) assert.match(home, new RegExp(`label: "${label}"`), label);
  assert.doesNotMatch(home, /label: "(Profession|E-mail de connexion)"/);
  assert.match(home, /Mes autres déclarations/);
  assert.match(home, /item\.provenance\?\.label \?\? "Déclaré par vous"/);
  assert.match(home, /Mon E‑Carnet ne les certifie pas/);
});

test("le métier d'un professionnel s'affiche sous son nom sur les deux accueils et sur sa carte", () => {
  const card = read("src/components/DossierCard.tsx");
  assert.match(card, /dossier__role/);
  assert.match(read("src/components/PatientHomeIdentity.tsx"), /role=\{role \|\| undefined\}/);
  assert.match(read("src/components/PatientHomeIdentity.tsx"), /useOwnProfession\(account\)/);
  assert.match(read("src/components/ProfessionalDossier.tsx"), /role=\{role\}/);
  assert.match(read("src/components/emergency-card/EmergencyCardVisual.tsx"), /ecard__role/);
});

test("scanner le QR : plus de case « documents », la demande inclut toujours la lecture seule", () => {
  const grants = read("src/components/ProfessionalAccessGrants.tsx");
  assert.doesNotMatch(grants, /checkbox|includeDocuments|Demander aussi/);
  assert.doesNotMatch(grants, /contrôlés par l’API|aucun accès avant le consentement/);
  assert.match(grants, /\["preconsultation", "declarations", "documents"\]/);
  const service = readFileSync(new URL("../../api/apps/care/services.py", import.meta.url), "utf8");
  assert.match(service, /REQUIRED_SCOPES = \("documents",\)/);
  assert.match(service, /\*REQUIRED_SCOPES/);
  assert.match(read("src/components/PatientAccessGrants.tsx"), /vos documents \(lecture seule\)/, "le patient est prévenu avant de décider");
});

test("équipe de l'établissement : une photo par médecin, fiche au clic avec révocation", () => {
  const consoleSrc = read("src/components/EstablishmentConsole.tsx");
  assert.match(consoleSrc, /className="team-photo"/);
  assert.match(consoleSrc, /function MemberDetail/);
  for (const label of ["Nom", "Prénoms", "Métier", "Âge"]) assert.match(consoleSrc, new RegExp(`\\["${label}", `));
  assert.match(consoleSrc, /memberships\/\$\{member\.id\}\/terminate\//);
  assert.match(consoleSrc, /tone: "danger"/, "confirmation avant de révoquer");
  assert.doesNotMatch(consoleSrc, /\{item\.professional_email \?\? ""\}<\/p><\/div><span className="badge active">/, "plus de ligne e-mail + badge dans la liste de l’équipe");
  const api = readFileSync(new URL("../../api/apps/establishments/views.py", import.meta.url), "utf8");
  assert.match(api, /professional_age/);
  assert.doesNotMatch(api, /item\["birth_date"\]/, "jamais la date de naissance");
});

test("onboarding : logo vers le site en haut, Retour et Suivant en bas de chaque étape, plus de lien de retour en haut", () => {
  const chrome = read("src/components/onboarding/OnboardingChrome.tsx");
  assert.match(chrome, /<Link className="onboarding-logo" href="\/"/);
  assert.match(chrome, />Retour<\/Link>/);
  for (const page of ["src/app/onboarding/page.tsx", "src/app/onboarding/identite/page.tsx", "src/app/onboarding/patient/page.tsx", "src/app/onboarding/securite/page.tsx"]) assert.match(read(page), /<OnboardingFrame>/, page);
  for (const file of ["IdentityOnboarding", "PatientOnboarding", "ProfessionalOnboarding", "ProfessionalStep3", "RecoverySetup", "RoleChoice"]) assert.match(read(`src/components/${file}.tsx`), /<OnboardingNav /, file);
  assert.match(read("src/components/ProfessionalCredentialsSettings.tsx"), /<OnboardingNav /);
  for (const page of ["src/app/professionnel/onboarding/page.tsx", "src/app/professionnel/onboarding/ordonnance/page.tsx", "src/app/onboarding/patient/page.tsx", "src/app/onboarding/identite/page.tsx"]) assert.doesNotMatch(read(page), /← (Accueil|Mon espace|Mon carnet patient)/, page);
  assert.doesNotMatch(read("src/components/IdentityOnboarding.tsx"), /Étape suivante : choisissez/);
});

test("étape 2 : « Je suis patient » / « Je suis professionnel », un rôle court, puis Suivant", () => {
  const role = read("src/components/RoleChoice.tsx");
  assert.match(role, /Je suis patient/);
  assert.match(role, /Je suis professionnel/);
  assert.match(role, /role="radiogroup"/);
  assert.match(role, /disabled=\{!role\}/, "Suivant attend un choix");
  assert.match(role, /initialRole/);
  assert.ok(existsSync(new URL("../src/components/onboarding/onboarding.css", import.meta.url)));
});

test("les textes retirés ou raccourcis ne reviennent pas", () => {
  assert.doesNotMatch(read("src/components/PatientOnboarding.tsx"), /Un seul compte, deux espaces/);
  assert.doesNotMatch(read("src/components/RecoverySetup.tsx"), /forme hachée/);
  assert.doesNotMatch(read("src/components/PatientAccessGrants.tsx"), /jeton opaque/);
});
