import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(testsDirectory, "..");
const testFiles = readdirSync(testsDirectory)
  .filter((name) => name.endsWith(".test.mjs"))
  .sort();
const packageJson = JSON.parse(readFileSync(path.join(webRoot, "package.json"), "utf8"));
const npmTest = packageJson.scripts?.test ?? "";

test("npm test lance tous les fichiers tests/*.test.mjs sans oubli ni référence cassée", () => {
  assert.match(npmTest, /(?:^|\s)--test(?:\s|$)/, "le script test doit invoquer le runner node --test");
  assert.match(npmTest, /tests\/\*\.test\.mjs/, "utiliser le glob POSIX pour découvrir tous les tests, y compris ce registre");

  const referencedFiles = [...npmTest.matchAll(/(?:^|\s)tests\/([^\s]+\.test\.mjs)(?=\s|$)/g)]
    .map((match) => match[1])
    .filter((name) => name !== "*.test.mjs")
    .sort();
  assert.deepEqual(referencedFiles, [], "ne pas revenir à une liste manuelle de tests qui pourrait diverger");
  assert.ok(testFiles.includes("test-registry.test.mjs"), "le registre doit s’inclure lui-même dans le glob");
  assert.ok(testFiles.length > 0, "au moins un test doit être enregistré");
});
