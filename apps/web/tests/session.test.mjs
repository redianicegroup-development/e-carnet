// Session absente : l'API renvoie 403 à un visiteur anonyme, pas seulement 401.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const { ApiError } = await import("../src/infrastructure/api/client.ts");
const { isSessionMissing } = await import("../src/lib/session.ts");
const read = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), "utf8");

test("401 et 403 : pas de session (l'API renvoie 403 à un visiteur anonyme)", () => {
  for (const status of [401, 403]) assert.equal(isSessionMissing(new ApiError("refusé", status)), true, `statut ${status}`);
});

test("serveur endormi, délai dépassé et vraies erreurs ne sont pas une session absente", () => {
  for (const status of [0, 404, 429, 500, 502, 503, 504]) assert.equal(isSessionMissing(new ApiError("x", status)), false, `statut ${status}`);
  assert.equal(isSessionMissing(new TypeError("Failed to fetch")), false);
  for (const value of ["n'importe quoi", null, undefined, 403, { status: "403" }]) assert.equal(isSessionMissing(value), false);
});

test("SpaceShell envoie vers la connexion sur 401 comme sur 403, sans revenir au seul 401", () => {
  const shell = read("components/shell/SpaceShell.tsx");
  assert.match(shell, /from "..\/..\/lib\/session"/);
  assert.match(shell, /checkingIdentity && isSessionMissing\(error\)/);
  assert.doesNotMatch(shell, /error\.status === 401/, "l'ancien test 401 seul est revenu");
});
