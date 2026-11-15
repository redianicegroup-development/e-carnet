// Script d'envoi Cloudinary du 15/11/2026 : il trie (déjà présent / absent) avant d'envoyer, et n'envoie que ce qui manque.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const script = require("../../../scripts/upload-cloudinary.cjs");
const BASE = "e-carnet/project";

const files = [
  { relative: "landing/a.webp", size: 10 },
  { relative: "landing/b.webp", size: 20 },
  { relative: "docs/c.pdf", size: 5 },
  { relative: "video/v.mp4", size: 99 },
];
const remote = new Map([
  [`image:${BASE}/landing/a`, { version: 111, bytes: 10 }],
  [`raw:${BASE}/docs/c`, { version: 222, bytes: 6 }],
]);

test("par défaut : seuls les fichiers absents de Cloudinary sont envoyés, les autres sont ignorés", () => {
  const plan = script.planUploads(files, remote, BASE);
  assert.deepEqual(plan.toUpload.map((item) => item.relative), ["landing/b.webp", "video/v.mp4"]);
  assert.deepEqual(plan.present.map((item) => [item.relative, item.version]), [["landing/a.webp", 111], ["docs/c.pdf", 222]]);
});

test("un fichier présent dont la taille diffère est signalé mais pas renvoyé, sauf avec --update", () => {
  const plain = script.planUploads(files, remote, BASE);
  assert.deepEqual(plain.sizeDiffers, ["docs/c.pdf"]);
  assert.ok(!plain.toUpload.some((item) => item.relative === "docs/c.pdf"));
  const update = script.planUploads(files, remote, BASE, { update: true });
  assert.deepEqual(update.toUpload.map((item) => item.relative), ["landing/b.webp", "docs/c.pdf", "video/v.mp4"]);
});

test("--force : tout est renvoyé comme avant", () => {
  const plan = script.planUploads(files, new Map(), BASE, { force: true });
  assert.equal(plan.toUpload.length, files.length);
  assert.equal(plan.present.length, 0);
});

test("l'identifiant public et le type suivent la même règle qu'à l'envoi (PDF et SVG en raw, vidéos en video)", () => {
  assert.equal(script.publicIdFor("landing/a.webp", BASE), `${BASE}/landing/a`);
  assert.equal(script.resourceTypeFor(".pdf"), "raw");
  assert.equal(script.resourceTypeFor(".svg"), "raw");
  assert.equal(script.resourceTypeFor(".mp4"), "video");
  assert.equal(script.resourceTypeFor(".webp"), "image");
});

test("la liste Cloudinary est paginée (next_cursor), filtrée par dossier, avec l'authentification de l'API Admin", async () => {
  const calls = [];
  const pages = {
    "image:": { resources: [{ public_id: `${BASE}/a`, version: 1, bytes: 10 }], next_cursor: "page2" },
    "image:page2": { resources: [{ public_id: `${BASE}/b`, version: 2, bytes: 20 }] },
    "video:": { resources: [] },
    "raw:": { resources: [{ public_id: `${BASE}/c`, version: 3, bytes: 5 }] },
  };
  const fetchImpl = async (url, options) => {
    calls.push({ url, auth: options.headers.Authorization });
    const parsed = new URL(url);
    const type = parsed.pathname.split("/")[4];
    return { ok: true, json: async () => pages[`${type}:${parsed.searchParams.get("next_cursor") ?? ""}`] };
  };
  const found = await script.listRemote({ cloudName: "demo", apiKey: "k", apiSecret: "s", baseFolder: BASE }, fetchImpl);
  assert.equal(found.size, 3);
  assert.deepEqual(found.get(`image:${BASE}/b`), { version: 2, bytes: 20 });
  assert.equal(calls.length, 4);
  assert.ok(calls.every((call) => new URL(call.url).searchParams.get("prefix") === `${BASE}/`));
  assert.ok(calls.every((call) => call.auth === `Basic ${Buffer.from("k:s").toString("base64")}`));
});

test("si Cloudinary refuse la liste, le script s'arrête au lieu de tout renvoyer", async () => {
  const fetchImpl = async () => ({ ok: false, status: 401, json: async () => ({ error: { message: "Invalid credentials" } }) });
  await assert.rejects(script.listRemote({ cloudName: "demo", apiKey: "k", apiSecret: "bad", baseFolder: BASE }, fetchImpl), /Invalid credentials/);
  const source = readFileSync(new URL("../../../scripts/upload-cloudinary.cjs", import.meta.url), "utf8");
  assert.match(source, /remote = await listRemote\(config\);/);
  assert.match(source, /main\(\)\.catch/);
});
