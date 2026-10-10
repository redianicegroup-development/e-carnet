import assert from "node:assert/strict";
import test from "node:test";

const { safeOAuthNext } = await import("../src/lib/auth.ts");

test("OAuth redirects to a safe internal destination", () => {
  assert.equal(safeOAuthNext("/onboarding/identite"), "/onboarding/identite");
  assert.equal(safeOAuthNext("/patient/parametres?tab=connexion"), "/patient/parametres?tab=connexion");
});

test("OAuth rejects external and malformed destinations", () => {
  assert.equal(safeOAuthNext("https://attacker.example"), "/patient");
  assert.equal(safeOAuthNext("//attacker.example"), "/patient");
  assert.equal(safeOAuthNext("/\\attacker.example"), "/patient");
  assert.equal(safeOAuthNext(null), "/patient");
});
