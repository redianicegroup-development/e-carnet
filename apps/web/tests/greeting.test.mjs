// Message d'accueil : « Bienvenue » uniquement pour un compte récent jamais accueilli, sinon Bonjour/Bonsoir selon l'heure locale.
import assert from "node:assert/strict";
import test from "node:test";

const greeting = await import("../src/components/modal/greeting.ts");

const at = (iso) => new Date(iso);
const NOW = at("2026-10-11T09:00:00");

test("bonjour entre 5 h et 17 h 59, bonsoir de 18 h à 4 h 59", () => {
  assert.equal(greeting.timeOfDay(at("2026-10-11T05:00:00")), "morning");
  assert.equal(greeting.timeOfDay(at("2026-10-11T12:30:00")), "morning");
  assert.equal(greeting.timeOfDay(at("2026-10-11T17:59:00")), "morning");
  assert.equal(greeting.timeOfDay(at("2026-10-11T18:00:00")), "evening");
  assert.equal(greeting.timeOfDay(at("2026-10-11T23:15:00")), "evening");
  assert.equal(greeting.timeOfDay(at("2026-10-11T02:00:00")), "evening");
  assert.equal(greeting.timeOfDay(at("2026-10-11T04:59:00")), "evening");
});

test("un compte créé il y a moins de 7 jours est nouveau, au-delà il est ancien", () => {
  assert.equal(greeting.isNewAccount("2026-10-10T09:00:00", NOW), true);
  assert.equal(greeting.isNewAccount("2026-10-04T09:00:01", NOW), true);
  assert.equal(greeting.isNewAccount("2026-10-04T08:59:00", NOW), false);
  assert.equal(greeting.isNewAccount("2026-01-01T00:00:00", NOW), false);
});

test("date d'inscription absente ou invalide : jamais de faux « bienvenue »", () => {
  assert.equal(greeting.isNewAccount(undefined, NOW), false);
  assert.equal(greeting.isNewAccount(null, NOW), false);
  assert.equal(greeting.isNewAccount("pas-une-date", NOW), false);
});

test("nouveau compte jamais accueilli → welcome", () => {
  const kind = greeting.decideGreeting({ dateJoined: "2026-10-11T08:00:00", now: NOW, alreadyWelcomed: false, alreadyGreetedThisSession: false });
  assert.equal(kind, "welcome");
});

test("nouveau compte déjà accueilli → bonjour/bonsoir ; ancien compte → bonjour/bonsoir", () => {
  assert.equal(greeting.decideGreeting({ dateJoined: "2026-10-11T08:00:00", now: NOW, alreadyWelcomed: true, alreadyGreetedThisSession: false }), "morning");
  assert.equal(greeting.decideGreeting({ dateJoined: "2025-01-01T00:00:00", now: NOW, alreadyWelcomed: false, alreadyGreetedThisSession: false }), "morning");
  assert.equal(greeting.decideGreeting({ dateJoined: "2025-01-01T00:00:00", now: at("2026-10-11T20:00:00"), alreadyWelcomed: false, alreadyGreetedThisSession: false }), "evening");
});

test("déjà salué pendant cette session → aucune modal", () => {
  assert.equal(greeting.decideGreeting({ dateJoined: "2026-10-11T08:00:00", now: NOW, alreadyWelcomed: false, alreadyGreetedThisSession: true }), null);
});

test("le prénom est nettoyé et borné ; vide si inconnu", () => {
  assert.equal(greeting.firstNameOf("  Elvis   "), "Elvis");
  assert.equal(greeting.firstNameOf("Jean   Marc"), "Jean Marc");
  assert.equal(greeting.firstNameOf(undefined), "");
  assert.equal(greeting.firstNameOf("x".repeat(100)).length, 40);
});
