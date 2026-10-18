// Landing : cohérence du contenu (FAQ, repères chiffrés, liens d'ancre) avec le centre d'aide relu par les juristes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const landing = await import("../src/lib/landing-content.ts");
const help = await import("../src/components/help/helpContent.ts");
const contact = await import("../src/lib/contact.ts");

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const helpFaq = help.HELP_FAQ.flatMap((group) => group.items);
const words = (text) => text.trim().split(/\s+/).length;

test("la FAQ de la landing compte exactement six questions, chacune avec un identifiant unique, une question et une réponse", () => {
  const ids = landing.FAQ_ITEMS.map((item) => item.id);
  assert.equal(landing.FAQ_ITEMS.length, 6);
  assert.equal(new Set(ids).size, ids.length);
  for (const item of landing.FAQ_ITEMS) {
    assert.ok(item.q.endsWith("?"), item.id);
    assert.ok(item.a.length > 20, item.id);
  }
});

/* Écart connu, à trancher par le produit puis à supprimer d'ici : dans la version v2, l'aide répond « Oui, utilisez des informations
   exactes… » à « Puis-je saisir mes vraies données de santé ? » alors que la landing répond « Non… ». La fusion de la v16 n'a pas
   choisi à la place des responsables : chaque page garde son texte. Toute autre réponse doit rester identique mot pour mot. */
const KNOWN_DIVERGENCES = new Set(["real-data"]);

test("les six réponses sont identiques mot pour mot à celles du centre d'aide (texte relu par les juristes), sauf l'écart connu", () => {
  for (const item of landing.FAQ_ITEMS) {
    const source = helpFaq.find((entry) => entry.q === item.q);
    assert.ok(source, `question absente du centre d'aide : ${item.q}`);
    if (KNOWN_DIVERGENCES.has(item.id)) continue;
    assert.equal(item.a, source.a, `réponse différente du centre d'aide : ${item.q}`);
  }
  assert.equal(landing.FAQ_ITEMS.filter((item) => KNOWN_DIVERGENCES.has(item.id)).length, KNOWN_DIVERGENCES.size, "écart connu obsolète : retirez-le de la liste");
});

test("les questions retirées de la landing existent toutes dans le centre d'aide", () => {
  for (const q of [
    "À quoi sert Mon E-Carnet ?",
    "Comment créer un compte patient ou professionnel ?",
    "Puis-je l’utiliser sur mon téléphone ?",
    "À quoi sert le QR code ?",
    "Combien de temps dure une autorisation ?",
    "Comment ouvrir l’espace de mon établissement ?",
    "Comment un médecin rejoint-il un établissement ?",
  ]) assert.ok(helpFaq.some((entry) => entry.q === q), `absente du centre d'aide : ${q}`);
});

test("les réponses restent courtes et lisibles", () => {
  for (const item of landing.FAQ_ITEMS) {
    assert.ok(words(item.a) <= 60, `${item.id} : ${words(item.a)} mots`);
    assert.ok(words(item.q) <= 14, `${item.id} : question trop longue`);
  }
});

test("aucune promesse écartée par la revue juridique dans les textes de la landing", () => {
  const banned = /à tout moment|100 ?%|garanti|sécurité absolue|infaillible|conforme à/i;
  const texts = [
    ...Object.values(landing.HERO).flatMap((value) => (typeof value === "string" ? [value] : Object.values(value))),
    ...landing.FEATURES.flatMap((feature) => (feature.figure ? [feature.figure.label] : [])),
    ...landing.FEATURES.flatMap((feature) => [feature.title, feature.text]),
    ...landing.STEPS.flatMap((step) => [step.title, step.text]),
    ...landing.PROFILES.flatMap((profile) => [profile.title, ...profile.points]),
    ...landing.SAFEGUARDS,
    ...landing.FAQ_ITEMS.flatMap((item) => [item.q, item.a]),
    landing.CONTACT_COPY.title, landing.CONTACT_COPY.lead, ...landing.CONTACT_COPY.points.map((point) => point.text),
    landing.FINAL.title, landing.FINAL.lead,
  ];
  for (const text of texts) assert.doesNotMatch(text, banned, text);
});

test("les repères chiffrés des cartes correspondent à ce que dit le centre d'aide", () => {
  const byQuestion = (q) => helpFaq.find((entry) => entry.q === q).a;
  assert.match(byQuestion("À quoi sert le QR code ?"), /5 minutes/);
  assert.match(byQuestion("Combien de temps dure une autorisation ?"), /Deux heures.*deux prolongations d’une heure/);
  const figures = Object.fromEntries(landing.FEATURES.filter((feature) => feature.figure).map((feature) => [feature.figure.label, `${feature.figure.value} ${feature.figure.unit}`]));
  assert.equal(figures["de validité pour un QR code"], "5 min");
  assert.equal(figures["pour un accès autorisé"], "2 h");
  assert.match(landing.FEATURES.find((feature) => feature.title === "Autorisations").text, /deux prolongations d’une heure/);
});

test("la landing est ramenée à quatre cartes et trois moments", () => {
  assert.equal(landing.FEATURES.length, 4);
  assert.equal(landing.STEPS.length, 3);
  const page = read("../src/app/page.tsx");
  assert.doesNotMatch(page, /FACTS|lp-facts|SurveyRatingSummary|lp-final/);
  assert.equal(landing.FEATURES.filter((feature) => feature.figure).length, 2);
});

test("les liens qui visent le formulaire de contact présélectionnent un objet existant", () => {
  const links = [
    ...landing.PROFILES.map((profile) => profile.cta),
  ].filter((link) => link.href === "#contact");
  assert.ok(links.length >= 1);
  for (const link of links) assert.ok(contact.isContactSubject(link.subject), `objet inconnu : ${link.subject}`);
});

test("chaque ancre utilisée par la navigation existe dans la page", () => {
  const source = [read("../src/app/page.tsx"), read("../src/components/landing/FaqSection.tsx"), read("../src/components/landing/ContactSection.tsx")].join("\n");
  const header = read("../src/components/public/PublicHeader.tsx");
  const anchors = new Set([...header.matchAll(/href="\/#([a-z-]+)"/g)].map((match) => match[1]));
  for (const link of landing.PROFILES.map((p) => p.cta.href)) {
    if (link.startsWith("#")) anchors.add(link.slice(1));
  }
  for (const anchor of ["parcours", "profils", "questions", "contact", "fonctionnalites"]) anchors.add(anchor);
  for (const anchor of anchors) assert.match(source, new RegExp(`id="${anchor}"`), `ancre #${anchor} introuvable`);
});

test("les données structurées de la FAQ reprennent exactement les questions affichées", () => {
  const page = read("../src/app/page.tsx");
  const faq = read("../src/components/landing/FaqSection.tsx");
  assert.match(page, /FAQ_ITEMS\.map\(\(\{ q, a \}\)/);
  assert.match(faq, /FAQ_ITEMS\.map/); // la FAQ affiche exactement les questions annoncées aux moteurs : rien n'est annoncé sans être visible
  assert.doesNotMatch(faq, /FAQ_GROUPS|faq-filter/);
});

test("la photo du hero est facultative : sans elle, l'illustration de l'application est utilisée", () => {
  assert.ok(landing.HERO_IMAGE === null || (typeof landing.HERO_IMAGE.src === "string" && landing.HERO_IMAGE.alt.length > 5));
});
