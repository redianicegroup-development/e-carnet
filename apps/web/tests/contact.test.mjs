// Formulaire de contact : mêmes règles que l'API (apps/api/apps/identity/contact_views.py), messages par champ, objet présélectionné.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const contact = await import("../src/lib/contact.ts");
const { CONTACT_LIMITS, CONTACT_SUBJECTS, EMPTY_CONTACT } = contact;

const valid = { firstName: "Aïcha", lastName: "Koné", contact: "aicha@example.test", subject: "question", message: "Bonjour, comment ouvrir un espace ?", consent: true };

test("un message complet est accepté, avec une adresse e-mail ou avec un numéro", () => {
  assert.deepEqual(contact.validateContact(valid), {});
  assert.deepEqual(contact.validateContact({ ...valid, contact: "+225 07 01 02 03 04" }), {});
  assert.deepEqual(contact.validateContact({ ...valid, contact: "07.01.02.03.04" }), {});
  assert.deepEqual(contact.validateContact({ ...valid, contact: "(225) 07-01-02-03-04" }), {});
});

test("un formulaire vide signale chaque champ avec son propre message", () => {
  const errors = contact.validateContact(EMPTY_CONTACT);
  assert.deepEqual(Object.keys(errors).sort(), ["consent", "contact", "firstName", "lastName", "message", "subject"]);
  assert.match(errors.firstName, /^Prénom/);
  assert.match(errors.lastName, /^Nom/);
  assert.match(errors.contact, /e-mail ou un numéro/);
  assert.match(errors.subject, /objet/);
});

test("le prénom et le nom : espaces superflus ignorés, 2 à 80 caractères", () => {
  assert.equal(contact.validateName("  A   ", "Prénom"), `Prénom : entre ${CONTACT_LIMITS.nameMin} et ${CONTACT_LIMITS.nameMax} caractères.`);
  assert.equal(contact.validateName("Li", "Nom"), undefined);
  assert.equal(contact.validateName("x".repeat(80), "Nom"), undefined);
  assert.ok(contact.validateName("x".repeat(81), "Nom"));
  assert.equal(contact.collapseSpaces("  Jean   Marc "), "Jean Marc");
});

test("« @ » désigne une adresse e-mail, sinon c'est un numéro", () => {
  assert.equal(contact.contactKind("a@b.co"), "email");
  assert.equal(contact.contactKind("0701020304"), "phone");
  for (const bad of ["a@", "@example.test", "a@b", "a b@example.test"]) assert.ok(contact.validateContactValue(bad), bad);
  for (const bad of ["12345", "1".repeat(16), "07 01 02 03 0x", "https://exemple.test", "07/01/02/03/04"]) assert.ok(contact.validateContactValue(bad), bad);
  assert.ok(contact.validateContactValue("a".repeat(250) + "@example.test"));
});

test("le message : 10 à 2 000 caractères une fois les espaces retirés", () => {
  assert.ok(contact.validateMessage("court"));
  assert.ok(contact.validateMessage("   neuf cars   "));
  assert.equal(contact.validateMessage("x".repeat(10)), undefined);
  assert.equal(contact.validateMessage("x".repeat(2000)), undefined);
  assert.match(contact.validateMessage("x".repeat(2001)), /trop long/);
});

test("l'objet doit faire partie de la liste proposée", () => {
  assert.equal(CONTACT_SUBJECTS.length, 8);
  assert.ok(contact.validateContact({ ...valid, subject: "autre-chose" }).subject);
  assert.equal(new Set(CONTACT_SUBJECTS.map((item) => item.value)).size, CONTACT_SUBJECTS.length);
});

test("le corps envoyé à l'API est nettoyé et contient le champ leurre vide", () => {
  const body = contact.contactPayload({ ...valid, firstName: "  Aïcha ", lastName: "Koné  ", contact: " aicha@example.test ", message: "  Bonjour tout le monde  " });
  assert.deepEqual(body, { first_name: "Aïcha", last_name: "Koné", contact: "aicha@example.test", subject: "question", message: "Bonjour tout le monde", consent: true, website: "" });
});

test("les erreurs de l'API sont rattachées aux bons champs, le reste est ignoré", () => {
  assert.deepEqual(contact.fieldErrorsFromApi({ first_name: "Prénom : trop court", message: "Trop court", inconnu: "x", subject: 42 }), { firstName: "Prénom : trop court", message: "Trop court" });
  assert.deepEqual(contact.fieldErrorsFromApi({ consent: "Cochez la case pour envoyer votre message." }), { consent: "Cochez la case pour envoyer votre message." });
  assert.deepEqual(contact.fieldErrorsFromApi(null), {});
  assert.deepEqual(contact.fieldErrorsFromApi("texte"), {});
});

test("un lien peut présélectionner l'objet, une valeur inconnue est ignorée", () => {
  assert.equal(contact.subjectFromQuery("establishment"), "establishment");
  assert.equal(contact.subjectFromQuery("<script>"), "");
  assert.equal(contact.subjectFromQuery(null), "");
  assert.equal(contact.subjectFromQuery(undefined), "");
});

test("le consentement est obligatoire : sans case cochée, rien ne peut partir", () => {
  assert.equal(EMPTY_CONTACT.consent, false, "la case démarre décochée");
  assert.match(contact.validateContact({ ...valid, consent: false }).consent, /case/);
  assert.deepEqual(Object.keys(contact.validateContact({ ...valid, consent: false })), ["consent"]);
  assert.equal(contact.validateConsent(true), undefined);
  for (const almost of ["true", "on", 1, null, undefined]) assert.ok(contact.validateConsent(almost), `${String(almost)} ne vaut pas consentement`);
  assert.equal(contact.contactPayload(valid).consent, true);
});

test("le formulaire affiche la case, la rend obligatoire et n'envoie rien tant qu'elle n'est pas cochée", () => {
  const form = readFileSync(new URL("../src/components/landing/ContactSection.tsx", import.meta.url), "utf8");
  assert.match(form, /type="checkbox" required checked=\{fields\.consent\}/, "case à cocher contrôlée et obligatoire");
  assert.match(form, /politique de confidentialité<\/Link> et j’accepte que mon nom, ma coordonnée et mon message soient enregistrés/);
  assert.match(form, /<Link href=\{privacyHref\} target="_blank" rel="noreferrer">/, "le lien s'ouvre à part : le visiteur ne perd pas son message");
  assert.match(form, /consent: true \}\);\s*\n\s*setErrors\(found\)/, "l'envoi marque la case comme vue");
  assert.match(form, /const found = validateContact\(current\);[\s\S]*if \(Object\.keys\(found\)\.length\) \{ focusFirst\(found\); return; \}[\s\S]*apiPost/, "la validation (consentement compris) précède l'appel API");
  assert.doesNotMatch(form, /lp-contact__legal/, "l'ancienne notice est remplacée par la case");
});
