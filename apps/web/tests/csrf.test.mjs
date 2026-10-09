// Garde-fou : la lecture du jeton CSRF a déjà été cassée par un « slice(9) » (« = » en tête, 403 sur toute écriture).
// Lancer : npm run test:web   (Node 22+)
import assert from "node:assert/strict";
import test from "node:test";

const client = await import("../src/infrastructure/api/client.ts");

test("lit la valeur du cookie csrftoken sans caractère parasite", () => {
  assert.equal(client.csrfFromCookie("csrftoken=abc123XYZ"), "abc123XYZ");
  assert.equal(client.csrfFromCookie("foo=1; csrftoken=abc%3D123; bar=2"), "abc=123");
  assert.equal(client.csrfFromCookie("sessionid=zzz"), "");
  assert.equal(client.csrfFromCookie(""), "");
});

test("garde en mémoire le jeton renvoyé en JSON (API et web sur des domaines différents)", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true, csrfToken: "from-json-token" }), { status: 200 });
  try {
    const response = await client.primeCsrf();
    assert.equal(response.ok, true);
    assert.equal(client.readCsrfToken(), "from-json-token");
  } finally {
    globalThis.fetch = original;
  }
});

test("aucun composant ne relit lui-même le cookie CSRF", async () => {
  const { readdir, readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = await Promise.all(entries.map((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)])));
    return files.flat();
  }
  const offenders = [];
  for (const file of (await walk(fileURLToPath(new URL("../src", import.meta.url)))).filter((name) => /\.tsx?$/.test(name))) {
    if (file.replaceAll("\\", "/").endsWith("infrastructure/api/client.ts")) continue;
    if (/document\.cookie/.test(await readFile(file, "utf8"))) offenders.push(file);
  }
  assert.deepEqual(offenders, []);
});
