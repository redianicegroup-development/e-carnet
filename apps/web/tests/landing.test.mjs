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

test("chaque question de la FAQ a un identifiant unique, une question et une réponse", () => {
  const ids = landing.FAQ_ITEMS.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(landing.FAQ_ITEMS.length, landing.FAQ_GROUPS.reduce((total, group) => total + group.items.length, 0));
  for (const item of landing.FAQ_ITEMS) {
    assert.ok(item.q.endsWith("?"), item.id);
    assert.ok(item.a.length > 20, item.id);
    assert.ok(["help", "landing", "composed"].includes(item.origin), item.id);
  }
});

test("les réponses reprises du centre d'aide sont identiques mot pour mot (texte relu par les juristes)", () => {
  const fromHelp = landing.FAQ_ITEMS.filter((item) => item.origin === "help");
  assert.ok(fromHelp.length >= 8);
  for (const item of fromHelp) {
    const source = helpFaq.find((entry) => entry.q === item.q);
    assert.ok(source, `question absente du centre d'aide : ${item.q}`);
    assert.equal(item.a, source.a, `réponse différente du centre d'aide : ${item.q}`);
  }
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
    ...landing.FACTS.map((fact) => fact.label),
    ...landing.FEATURES.flatMap((feature) => [feature.title, feature.text]),
    ...landing.STEPS.flatMap((step) => [step.title, step.text]),
    ...landing.PROFILES.flatMap((profile) => [profile.title, ...profile.points]),
    ...landing.SAFEGUARDS,
    ...landing.FAQ_ITEMS.flatMap((item) => [item.q, item.a]),
    landing.CONTACT_COPY.title, landing.CONTACT_COPY.lead, ...landing.CONTACT_COPY.points.map((point) => point.text),
  ];
  for (const text of texts) assert.doesNotMatch(text, banned, text);
});

test("les repères chiffrés correspondent à ce que dit le centre d'aide", () => {
  const byQuestion = (q) => helpFaq.find((entry) => entry.q === q).a;
  assert.match(byQuestion("À quoi sert le QR code ?"), /5 minutes/);
  assert.match(byQuestion("Combien de temps dure une autorisation ?"), /Deux heures.*deux prolongations d’une heure/);
  const facts = Object.fromEntries(landing.FACTS.map((fact) => [fact.label, `${fact.value} ${fact.unit}`]));
  assert.equal(facts["de validité pour un QR code"], "5 min");
  assert.equal(facts["pour un accès autorisé"], "2 h");
  assert.equal(facts["de prolongation au plus"], "2 × 1 h");
  assert.equal(landing.FACTS.length, 4);
});

test("les liens qui visent le formulaire de contact présélectionnent un objet existant", () => {
  const links = [
    ...landing.PROFILES.map((profile) => profile.cta),
    ...landing.FAQ_ITEMS.flatMap((item) => (item.link ? [item.link] : [])),
  ].filter((link) => link.href === "#contact");
  assert.ok(links.length >= 2);
  for (const link of links) assert.ok(contact.isContactSubject(link.subject), `objet inconnu : ${link.subject}`);
});

test("chaque ancre utilisée par la navigation existe dans la page", () => {
  const source = [read("../src/app/page.tsx"), read("../src/components/landing/FaqSection.tsx"), read("../src/components/landing/ContactSection.tsx")].join("\n");
  const header = read("../src/components/public/PublicHeader.tsx");
  const anchors = new Set([...header.matchAll(/href="\/#([a-z-]+)"/g)].map((match) => match[1]));
  for (const link of [...landing.PROFILES.map((p) => p.cta.href), ...landing.FAQ_ITEMS.flatMap((i) => (i.link ? [i.link.href] : []))]) {
    if (link.startsWith("#")) anchors.add(link.slice(1));
  }
  for (const anchor of ["parcours", "profils", "questions", "contact", "fonctionnalites"]) anchors.add(anchor);
  for (const anchor of anchors) assert.match(source, new RegExp(`id="${anchor}"`), `ancre #${anchor} introuvable`);
});

test("les données structurées de la FAQ reprennent exactement les questions affichées", () => {
  const page = read("../src/app/page.tsx");
  const faq = read("../src/components/landing/FaqSection.tsx");
  assert.match(page, /FAQ_ITEMS\.map\(\(\{ q, a \}\)/);
  assert.match(faq, /FAQ_GROUPS/); // la FAQ affiche tous les groupes : rien n'est annoncé aux moteurs sans être visible
});

test("la photo du hero est facultative : sans elle, l'illustration de l'application est utilisée", () => {
  assert.ok(landing.HERO_IMAGE === null || (typeof landing.HERO_IMAGE.src === "string" && landing.HERO_IMAGE.alt.length > 5));
});
