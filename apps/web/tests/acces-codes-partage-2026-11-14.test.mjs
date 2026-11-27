// V1.15 — première connexion (modals succès / erreur, nouveau mot de passe), partage des codes, labo interne à plusieurs administrateurs,
// fiche d'onboarding du laboratoire.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), "utf8");
const share = await import("../src/lib/share.ts");
const outcome = await import("../src/lib/access-outcome.ts");

/* ---------- partage ---------- */
test("le partage ouvre la feuille de partage quand elle existe, avec le message tel quel", async () => {
  const calls = [];
  const result = await share.shareContent({ title: "t", text: "message" }, { share: async (data) => { calls.push(data); }, writeText: async () => { throw new Error("ne doit pas copier"); } });
  assert.equal(result, "shared");
  assert.deepEqual(calls, [{ title: "t", text: "message" }]);
});

test("fermer la feuille de partage n'est pas une erreur et ne copie rien à la place de la personne", async () => {
  let copied = false;
  const abort = Object.assign(new Error("annulé"), { name: "AbortError" });
  const result = await share.shareContent({ title: "t", text: "m" }, { share: async () => { throw abort; }, writeText: async () => { copied = true; } });
  assert.equal(result, "cancelled");
  assert.equal(copied, false);
});

test("sans feuille de partage, ou si elle échoue, le message est copié ; sans presse-papiers, on le dit", async () => {
  const copied = [];
  assert.equal(await share.shareContent({ title: "t", text: "m1" }, { writeText: async (text) => { copied.push(text); } }), "copied");
  assert.equal(await share.shareContent({ title: "t", text: "m2" }, { share: async () => { throw new Error("NotAllowedError"); }, writeText: async (text) => { copied.push(text); } }), "copied");
  assert.deepEqual(copied, ["m1", "m2"]);
  assert.equal(await share.shareContent({ title: "t", text: "m" }, { writeText: async () => { throw new Error("refusé"); } }), "failed");
  assert.equal(await share.shareContent({ title: "t", text: "m" }, {}), "failed");
  assert.equal(share.SHARE_FEEDBACK.cancelled, "");
  assert.ok(share.SHARE_FEEDBACK.failed.length > 0 && share.SHARE_FEEDBACK.copied.length > 0);
});

test("le message d'un accès contient le lien, l'e-mail exact et le mot de passe temporaire", () => {
  const text = share.accessMessage({ kind: "laboratory", structure: "Laboratoire Clinique Ccf", email: "labo@example.test", password: "xMh2-3TuG-xViP-qDU2", loginUrl: share.loginUrlFor("https://app.example.test/") });
  assert.match(text, /Connexion : https:\/\/app\.example\.test\/connexion/);
  assert.match(text, /E‑mail : labo@example\.test/);
  assert.match(text, /Mot de passe temporaire : xMh2-3TuG-xViP-qDU2/);
  assert.match(text, /administrateur du laboratoire « Laboratoire Clinique Ccf »/);
  assert.match(share.accessMessage({ kind: "establishment", structure: "Clinique Ccf", email: "a@b.test", password: "p", loginUrl: "u" }), /administrateur de « Clinique Ccf »/);
});

test("les messages de code médecin et de proche de confiance portent le code et le lien où le saisir", () => {
  const join = share.joinCodeMessage({ code: "ABCD-EFGH", expiresAt: "2026-11-16T12:00:00Z", accessUrl: "https://app.example.test/professionnel/acces" });
  assert.match(join, /Code : ABCD-EFGH/);
  assert.match(join, /https:\/\/app\.example\.test\/professionnel\/acces/);
  const trusted = share.delegationMessage({ code: "ECM-PROCHE-XYZ", trustedUrl: "https://app.example.test/patient/proches" });
  assert.match(trusted, /Mot : ECM-PROCHE-XYZ/);
  assert.match(trusted, /https:\/\/app\.example\.test\/patient\/proches/);
  assert.match(share.recoveryPasswordMessage({ email: "a@b.test", password: "pw", loginUrl: "u" }), /Mot de passe temporaire : pw/);
});

test("un bouton Partager accompagne chaque code généré", () => {
  const withShare = {
    "src/components/EstablishmentLaboratories.tsx": /<ShareCodeButton[\s\S]*accessMessage\(/,
    "src/components/EstablishmentJoinCodes.tsx": /<ShareCodeButton[\s\S]*joinCodeMessage\(/,
    "src/components/EstablishmentAdminWorkspace.tsx": /<ShareCodeButton[\s\S]*joinCodeMessage\(/,
    "src/components/TrustedContactDelegationClient.tsx": /<ShareCodeButton[\s\S]*delegationMessage\(/,
    "src/components/AdminEstablishmentsClient.tsx": /<ShareCodeButton[\s\S]*transmissionMessage\(/,
  };
  for (const [file, pattern] of Object.entries(withShare)) assert.match(read(file), pattern, file);
  const button = read("src/components/ShareCodeButton.tsx");
  assert.match(button, /aria-label=/);
  assert.match(button, /role="status" aria-live="polite"/);
});

/* ---------- modals de résultat ---------- */
test("première connexion : « accès accordé » nomme la structure, laboratoire comme établissement", () => {
  const lab = outcome.firstAccessCopy({ kind: "laboratory", establishment_name: "Laboratoire Clinique Ccf", parent_name: "Clinique Ccf" });
  assert.equal(lab.title, "Accès accordé");
  assert.match(lab.message, /administrer le laboratoire de l’établissement « Clinique Ccf »/);
  assert.match(lab.note, /mot de passe/);
  const clinic = outcome.firstAccessCopy({ kind: "establishment", establishment_name: "Clinique Ccf", parent_name: "" });
  assert.match(clinic.message, /administrer l’établissement « Clinique Ccf »/);
});

test("médecin : la saisie du code envoie une demande (jamais « accès accordé »), proche : l'accès est accordé", () => {
  const sent = outcome.joinRequestSentCopy("Clinique Ccf");
  assert.equal(sent.title, "Demande envoyée");
  assert.match(sent.message, /Clinique Ccf/);
  assert.match(sent.note, /confirmée/);
  assert.doesNotMatch(`${sent.title} ${sent.message}`, /accordé/i);
  assert.match(outcome.joinRequestSentCopy("").message, /demande de rattachement/);
  const accepted = outcome.delegationAcceptedCopy("Awa", "Koné");
  assert.equal(accepted.title, "Accès accordé");
  assert.match(accepted.message, /proche de confiance de Awa Koné/);
});

test("une erreur garde le motif du serveur, sinon un motif de repli clair", () => {
  assert.equal(outcome.errorReason(new Error("Ce mot de passe temporaire a expiré."), "repli"), "Ce mot de passe temporaire a expiré.");
  assert.equal(outcome.errorReason(new Error("  "), "repli"), "repli");
  assert.equal(outcome.errorReason("chaîne", outcome.CODE_ERROR_FALLBACK), outcome.CODE_ERROR_FALLBACK);
});

test("la connexion ouvre le modal de succès puis l'écran du nouveau mot de passe, et les erreurs ont un titre qui dit le motif", () => {
  const forms = read("src/components/AuthForms.tsx");
  assert.match(forms, /account\.must_change_password && account\.first_access/);
  assert.match(forms, /<OutcomeDialog tone="success"[\s\S]*router\.replace\(destination\)/);
  assert.match(forms, /"Mot de passe temporaire expiré"/);
  assert.match(forms, /"E-mail ou mot de passe incorrect"/);
  assert.match(forms, /Trop de tentatives/);
});

test("saisie d'un code : le modal de succès et le modal d'erreur remplacent le simple message", () => {
  const pro = read("src/components/ProfessionalAccess.tsx");
  assert.match(pro, /joinRequestSentCopy\(/);
  assert.match(pro, /title: "Code refusé"/);
  const trusted = read("src/components/TrustedContactDelegationClient.tsx");
  assert.match(trusted, /delegationAcceptedCopy\(/);
  assert.match(trusted, /title: "Mot de rattachement refusé"/);
});

/* ---------- nouveau mot de passe ---------- */
test("l'écran du nouveau mot de passe ne demande que le nouveau et sa confirmation, avec un œil par champ", () => {
  const screen = read("src/components/auth/PasswordChangeRequired.tsx");
  assert.match(screen, /label="Nouveau mot de passe"/);
  assert.match(screen, /label="Confirmer le nouveau mot de passe"/);
  // Le mot de passe temporaire n'est redemandé que si le serveur l'exige.
  assert.match(screen, /\{needsCurrent && <PasswordField/);
  assert.match(screen, /current_password_required/);
  assert.match(screen, /\.\.\.\(needsCurrent \? \{ current_password: values\.current \} : \{\}\)/);
  const field = read("src/components/auth/PasswordField.tsx");
  assert.match(field, /aria-pressed=\{shown\}/);
  assert.match(field, /type=\{shown \? "text" : "password"\}/);
});

/* ---------- rattachement du laboratoire ---------- */
test("rattacher un laboratoire : pas de nom de laboratoire, seulement prénom, nom et e-mail de l'administrateur", () => {
  const form = read("src/components/EstablishmentLaboratories.tsx");
  assert.doesNotMatch(form, /Nom du laboratoire/);
  assert.match(form, /Prénom de l’administrateur/);
  assert.match(form, /Nom de l’administrateur/);
  assert.match(form, /E-mail de l’administrateur du laboratoire \(son identifiant de connexion\)/);
  assert.match(form, /Ajouter un administrateur/);
  const api = read("src/application/lab-results.ts");
  assert.match(api, /input: \{ admin_email: string; admin_first_name: string; admin_last_name: string \}/);
  assert.doesNotMatch(api, /createLaboratory = \(establishmentId: string, input: \{ name/);
});

/* ---------- fiche d'onboarding ---------- */
test("fiche d'onboarding : aucun code interne, établissement de rattachement pour un labo, type verrouillé", () => {
  const editor = read("src/components/EstablishmentProfileEditor.tsx");
  assert.match(editor, /const showInternalCode = scope === "identity" && !lab;/);
  assert.match(editor, /\{showInternalCode && <div><dt>Code interne/);
  assert.doesNotMatch(editor, /\{identity && <div><dt>Code interne/);
  assert.match(editor, /Établissement \(verrouillé\)/);
  assert.match(editor, /profile\.parent_name/);
  assert.match(editor, /Type de structure \(verrouillé\)/);
  assert.match(editor, /disabled=\{busy \|\| typeLocked\}/);
  // « Dernière mise à jour » est conservée.
  assert.match(editor, /<dt>Dernière mise à jour<\/dt>/);
});
