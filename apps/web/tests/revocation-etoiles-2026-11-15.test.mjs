import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* Lot du 15/11/2026 : révocation avec motif, slogan, note en étoiles, crédits, proches de confiance, retraits de réglages, textes d'aide et légaux.
   Même méthode que les autres tests de ce dossier : on lit les sources et on vérifie ce qui doit y être (et ce qui ne doit plus y être). */
const root = new URL("../", import.meta.url);
const read = (file) => readFileSync(new URL(file, root), "utf8");
const readApi = (file) => readFileSync(new URL(`../api/${file}`, root), "utf8");

test("révocation avec motif : fenêtre dédiée, motif obligatoire de 3 à 500 caractères, erreur gardée dans la fenêtre", () => {
  const dialog = read("src/components/modal/RevocationReasonDialog.tsx");
  assert.match(dialog, /REVOCATION_REASON_MIN = 3/);
  assert.match(dialog, /REVOCATION_REASON_MAX = 500/);
  assert.match(dialog, /disabled=\{busy \|\| !valid\}/, "pas de révocation sans motif valide");
  assert.match(dialog, /role="alert"/, "l'erreur du serveur reste dans la fenêtre");
  assert.match(dialog, /visible par la personne à sa prochaine connexion/i);
});

test("laboratoire : « Profil » par administrateur, fiche (prénom, nom, e-mail, accès) et révocation avec motif", () => {
  const labs = read("src/components/EstablishmentLaboratories.tsx");
  assert.match(labs, /<ProfileGrid label=\{`Administrateurs · \$\{lab\.name\}`\}>[\s\S]*<Profile key=\{admin\.id\}/, "chaque administrateur est une photo ; la fiche vient du composant Profil commun (19/11/2026)");
  assert.match(labs, /function administratorRows/);
  for (const label of ["Prénom", "Nom", "E-mail \\(identifiant de connexion\\)", "Accès"]) assert.match(labs, new RegExp(`\\{ label: "${label}"`));
  assert.match(labs, /label: "Révoquer", tone: "danger"/);
  assert.match(labs, /revokeLaboratoryAdministrator\(establishmentId, revokeTarget\.lab\.id, revokeTarget\.admin\.id, reason\)/);
  assert.match(read("src/application/lab-results.ts"), /administrators\/\$\{administratorId\}\/revoke\/`, \{ reason \}/);
});

test("avis de révocation : montré à la connexion, marqué lu à la fermeture, jamais au milieu d'un changement de mot de passe", () => {
  const notices = read("src/components/RevocationNotices.tsx");
  assert.match(notices, /revocation-notices\/ack\//);
  assert.match(notices, /Motif : \$\{notice\.reason\}/);
  const shell = read("src/components/shell/SpaceShell.tsx");
  assert.match(shell, /revocation_notices\?: RevocationNotice\[\]/);
  assert.match(shell, /!passwordChangePending && \(state\.account\.revocation_notices\?\.length \?\? 0\) > 0/);
  assert.match(read("src/components/ProfessionalMembershipDetail.tsx"), /Rattachement retiré par l’établissement\. Motif/);
});

test("API : la révocation exige un motif, prévient par push sans le motif, l'avis suit le compte", () => {
  const rev = readApi("apps/establishments/revocations.py");
  assert.match(rev, /REASON_MIN_LENGTH = 3/);
  assert.match(rev, /jamais le motif/i);
  assert.match(rev, /def notify_revoked\(user_id, kind, url="\/"\)/, "la fonction d'envoi ne reçoit même pas le motif");
  const views = readApi("apps/establishments/views.py");
  assert.match(views, /clean_reason\(request\.data\.get\("reason"\)\)/);
  assert.match(readApi("apps/establishments/laboratories.py"), /class LaboratoryAdministratorRevokeView/);
  assert.match(readApi("apps/identity/auth_serializers.py"), /def get_revocation_notices/);
  assert.match(readApi("apps/establishments/migrations/0018_revocation_reasons.py"), /termination_reason/);
});

test("slogan : une seule constante, sur la connexion, À propos, Crédits, Sécurité et l'Aide ; plus de ligne sous le slogan du pied de page", () => {
  assert.match(read("src/lib/brand.ts"), /APP_SLOGAN = "Gardez le fil avec Mon E‑Carnet\."/);
  assert.match(read("src/app/connexion/page.tsx"), /<h1 id="auth-title">\{APP_SLOGAN\}<\/h1>/);
  assert.doesNotMatch(read("src/app/connexion/page.tsx"), /Votre santé, votre carnet, votre décision/);
  for (const file of ["src/app/a-propos/page.tsx", "src/app/credits/page.tsx", "src/app/securite/page.tsx", "src/components/help/HelpCenter.tsx"]) assert.match(read(file), /<AppSlogan \/>/, file);
  assert.doesNotMatch(read("src/components/public/PublicShell.tsx"), /pub-footer__tagline/);
});

test("« Noter l'application » : étoiles dynamiques (groupe radio, clavier), note envoyée, vue admin avec moyenne", () => {
  const input = read("src/components/ui/StarRatingInput.tsx");
  assert.match(input, /role="radiogroup"/);
  assert.match(input, /role="radio"/);
  assert.match(input, /ArrowRight/);
  assert.match(input, /onMouseEnter=\{\(\) => setHover\(star\)\}/, "aperçu dynamique");
  const widget = read("src/components/LandingFeedbackWidget.tsx");
  assert.match(widget, /<StarRatingInput value=\{rating\} onChange=\{setRating\}/);
  assert.match(widget, /\.\.\.\(rating \? \{ rating \} : \{\}\)/);
  const admin = read("src/app/admin/page.tsx");
  assert.match(admin, /feedback_average_rating/);
  assert.match(admin, /<StarRating value=\{item\.rating\}/);
  assert.match(readApi("apps/identity/migrations/0021_sitefeedback_rating.py"), /name="rating"/);
});

test("crédits : quatre membres, statuts et rôles du site Redianice, plus de chef de projet ni de deux graphistes", async () => {
  const { CREDITS_TEAM } = await import("../src/lib/credits.ts");
  assert.deepEqual(CREDITS_TEAM.map((member) => member.id), ["fondateur-juridique", "developpement", "design", "communication"]);
  assert.deepEqual(CREDITS_TEAM.map((member) => member.role), ["Founder of Redianice & Legal Officer", "Chief Technology Officer (CTO)", "Lead Brand Designer", "Community Manager & Infographiste"]);
  const text = JSON.stringify(CREDITS_TEAM);
  assert.doesNotMatch(text, /Chef de projet|Deux graphistes|deux graphistes/);
});

test("réglages : Économie de données et paragraphe de personnalisation retirés", () => {
  assert.doesNotMatch(read("src/components/ThemeSettingsClient.tsx"), /Choisissez une paire de polices/);
  assert.match(read("src/components/ThemeSettingsClient.tsx"), /Thème personnel/, "le titre reste");
  assert.doesNotMatch(read("src/app/confidentialite/page.tsx"), /Économie de données/);
});

test("proches de confiance : deux tuiles « Donner accès » / « Reçu accès », modals succès et erreur ; profils représentés avec modals", () => {
  const trusted = read("src/components/TrustedContactDelegationClient.tsx");
  assert.match(trusted, /<strong>Donner accès<\/strong>/);
  assert.match(trusted, /<strong>Reçu accès<\/strong>/);
  assert.doesNotMatch(trusted, /Générer pour un proche|J’ai reçu un mot/, "les deux intitulés de section sont remplacés par les tuiles");
  assert.match(trusted, /tone: "error", title: "Mot de rattachement non généré"/);
  assert.match(trusted, /Mot de rattachement généré/);
  const reps = read("src/components/PatientRepresentationsSettingsClient.tsx");
  const onboarding = read("src/components/ChildOnboarding.tsx");
  assert.match(onboarding, /tone: "success", title: "Profil créé"/);
  assert.match(onboarding, /tone: "error", title: "Profil non créé"/);
  assert.doesNotMatch(reps + onboarding, /pas encore activé/);
  assert.match(onboarding, /<label className="check"><input required type="checkbox"/, "case à cocher sortie de .field");
  const settings = readApi("config/settings.py");
  assert.match(settings, /ECARNET_TRUSTED_CONTACTS_ENABLED = os\.environ\.get\("ECARNET_TRUSTED_CONTACTS_ENABLED", "true"\)/);
  assert.match(settings, /os\.environ\.get\("ECARNET_REPRESENTATION_LEGAL_AGE", "18"\)/);
});

test("aide et pages légales à jour : révocation avec motif, étoiles, proches de confiance activés", () => {
  const help = read("src/components/help/helpContent.ts");
  assert.match(help, /Comment retirer un médecin ou un administrateur du laboratoire/);
  assert.match(help, /note de 1 à 5 étoiles/);
  assert.match(help, /« Donner accès » le génère et « Reçu accès »/);
  assert.match(read("src/app/cgu/page.tsx"), /avec un motif obligatoire/);
  assert.match(read("src/app/conditions-rattachement/page.tsx"), /Si l’établissement met fin au rattachement/);
  assert.doesNotMatch(read("src/app/proches-et-enfants/page.tsx"), /n’est pas encore activée/);
  const privacy = read("src/app/confidentialite/page.tsx");
  assert.match(privacy, /note facultative de 1 à 5 étoiles/);
  assert.match(privacy, /jamais envoyé dans la notification push/);
});
