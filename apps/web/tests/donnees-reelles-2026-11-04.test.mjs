// Décision « données de santé réelles » : les textes publics disent la même chose que le NO-GO documenté, depuis un interrupteur unique.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const policy = await import("../src/lib/data-policy.ts");
const offline = await import("../src/lib/offline-policy.ts");

const ALLOWS = /accepte (la saisie de )?de vraies|peuvent être saisies|traite déjà de vraies|Oui\. En production interne/;
const RESTRICTS = /fictives|n’est pas autorisée|Pas encore|avant toute ouverture aux données/i;

test("interrupteur : tant que le Go n'est pas signé, les données réelles ne sont pas autorisées", () => {
  assert.equal(policy.REAL_HEALTH_DATA_ALLOWED, false);
  assert.deepEqual(policy.DATA_POLICY, policy.dataPolicy(false));
});

test("données réelles refusées : FAQ, politique de confidentialité et page /v1 parlent de phase de test, sans promesse contraire", () => {
  const text = policy.dataPolicy(false);
  assert.match(text.faq.a, /^Pas encore\./);
  assert.match(text.faq.a, /uniquement des données fictives/);
  assert.match(text.faq.a, /validations juridique, médicale, de sécurité et d’hébergement/);
  assert.match(text.faq.a, /infirmier n’a pas de compte/, "le reste de la réponse (parcours de pré-consultation) est conservé");
  assert.match(text.faq.a, /pas ouvert au grand public/);
  for (const [name, value] of Object.entries({ faq: text.faq.a, providers: text.providersNote, input: text.inputNote, hosting: text.hostingNote })) {
    assert.doesNotMatch(value, ALLOWS, `${name} : ne doit pas affirmer que de vraies données sont saisies ou traitées`);
  }
  for (const value of [text.faq.a, text.providersNote, text.inputNote, text.hostingNote]) assert.match(value, RESTRICTS);
  assert.equal(text.environmentLabel, "environnement du service");
  assert.match(text.v1Scope, /données fictives uniquement/);
});

test("données réelles autorisées : le texte d'origine est conservé et ne parle plus de données fictives", () => {
  const text = policy.dataPolicy(true);
  assert.match(text.faq.a, /^Oui\. En production interne/);
  assert.match(text.providersNote, /accepte de vraies informations de santé/);
  assert.match(text.hostingNote, /traite déjà de vraies données de santé/);
  assert.equal(text.environmentLabel, "environnement de production interne");
  for (const value of [text.faq.a, text.providersNote, text.inputNote, text.hostingNote, text.v1Scope]) assert.doesNotMatch(value, /fictives?\b/i);
});

test("les cinq passages du site viennent de l'interrupteur (plus aucune phrase écrite en dur)", () => {
  const privacy = read("src/app/confidentialite/page.tsx");
  assert.match(privacy, /<strong>\{DATA_POLICY\.environmentLabel\}<\/strong>\. \{DATA_POLICY\.providersNote\}/);
  assert.match(privacy, /<p>\{DATA_POLICY\.inputNote\}<\/p>/);
  assert.match(privacy, /<p>\{DATA_POLICY\.hostingNote\}<\/p>/);
  assert.match(read("src/components/help/helpContent.ts"), /q: DATA_POLICY\.faq\.q, a: DATA_POLICY\.faq\.a/);
  assert.match(read("src/lib/landing-content.ts"), /q: DATA_POLICY\.faq\.q, a: DATA_POLICY\.faq\.a/);
  assert.match(read("src/app/v1/page.tsx"), /DATA_POLICY\.v1Scope,/);
  for (const file of ["src/app/confidentialite/page.tsx", "src/components/help/helpContent.ts", "src/lib/landing-content.ts", "src/app/v1/page.tsx"]) {
    assert.doesNotMatch(read(file), /production interne (accepte|traite)|de vraies informations de santé peuvent|Cet environnement accepte de vraies/, `${file} : phrase écrite en dur`);
  }
});

test("la FAQ de l'accueil et celle de l'Aide donnent la même réponse sur les vraies données", () => {
  const help = read("src/components/help/helpContent.ts");
  const landing = read("src/lib/landing-content.ts");
  assert.equal([...help.matchAll(/DATA_POLICY\.faq\.a/g)].length, 1);
  assert.equal([...landing.matchAll(/DATA_POLICY\.faq\.a/g)].length, 1);
});

test("garde-fou : on ne peut pas autoriser les données réelles avec une copie hors connexion activée par défaut et non chiffrée", () => {
  // Depuis le 05/11/2026 la copie est chiffrée (AES-GCM, clé non extractible), mais la clé est celle de l'APPAREIL : une personne qui utilise le
  // navigateur ouvert la lit. Le critère de docs/DONNEES-REELLES-DECISION.md reste donc : copie désactivée par défaut OU chiffrée avec un code
  // de l'utilisateur. Passer REAL_HEALTH_DATA_ALLOWED à true exige l'un des deux ; ce test ne sera adapté qu'en le disant dans ce document.
  const encryptedWithUserSecret = false;
  assert.match(read("src/lib/offline-cache.ts"), /generateKey\(\{ name: "AES-GCM", length: 256 \}, false,/, "la copie est chiffrée par une clé non extractible de l'appareil");
  assert.equal(policy.REAL_HEALTH_DATA_ALLOWED && offline.OFFLINE_DECLARATIONS_DEFAULT_ENABLED && !encryptedWithUserSecret, false);
  assert.equal(offline.OFFLINE_DECLARATIONS_DEFAULT_ENABLED, true, "phase de test : active par défaut (données fictives)");
  assert.match(read("src/lib/offline-policy.ts"), /OFFLINE_DECLARATIONS_DEFAULT_ENABLED = true/);
});

test("le document de décision existe et nomme l'interrupteur, les critères hors code et le garde-fou", () => {
  const doc = read("../../docs/DONNEES-REELLES-DECISION.md");
  assert.match(doc, /REAL_HEALTH_DATA_ALLOWED/);
  assert.match(doc, /lib\/data-policy\.ts/);
  assert.match(doc, /ARTCI/);
  assert.match(doc, /OFFLINE_DECLARATIONS_DEFAULT_ENABLED/);
  assert.match(doc, /ECARNET_ESTABLISHMENT_ADMIN_CLINICAL_READ/);
});
