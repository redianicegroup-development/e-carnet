const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Charge .env.local sans dépendance supplémentaire. Les secrets ne sont jamais écrits dans le dépôt.
for (const envPath of [path.join(__dirname, '..', '.env.local'), path.join(__dirname, '..', 'apps', 'web', '.env.local')]) {
  if (!fs.existsSync(envPath)) continue;
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const equalsIdx = trimmed.indexOf('=');
    if (equalsIdx === -1) return;
    const key = trimmed.slice(0, equalsIdx).trim();
    const value = trimmed.slice(equalsIdx + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (!process.env[key]) process.env[key] = value;
  });
}

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;
if (!cloudName || !apiKey || !apiSecret) {
  console.error('CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY et CLOUDINARY_API_SECRET sont requis.');
  process.exit(1);
}

const BASE_FOLDER = process.env.CLOUDINARY_BASE_FOLDER || 'e-carnet/project';
const defaultSource = path.join(__dirname, '..', 'apps', 'web', 'public');
const sourceDir = path.resolve(process.env.CLOUDINARY_SOURCE_DIR || defaultSource);
const manifestPath = path.join(__dirname, '..', 'apps', 'web', 'src', 'data', 'cloudinaryVersions.js');
const MEDIA_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif', '.webm', '.mp4', '.mov']);
const VIDEO_EXTENSIONS = new Set(['.webm', '.mp4', '.mov']);
const RAW_EXTENSIONS = new Set(['.pdf', '.svg']);
const dryRun = process.argv.includes('--dry-run');

function filesRecursively(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesRecursively(full) : [full];
  });
}
function signature(params) {
  const body = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&') + apiSecret;
  return crypto.createHash('sha1').update(body).digest('hex');
}
function localKey(relativePath) { return `/${relativePath.replaceAll('\\', '/')}`; }
function readManifest() {
  if (!fs.existsSync(manifestPath)) return {};
  const source = fs.readFileSync(manifestPath, 'utf8');
  const match = source.match(/export const CLOUDINARY_VERSIONS = (\{[\s\S]*\})\s*$/);
  if (!match) return {};
  try { return Function(`"use strict"; return (${match[1]})`)(); } catch { return {}; }
}
function writeManifest(versions) {
  const entries = Object.keys(versions).sort().map(key => `  ${JSON.stringify(key)}: ${JSON.stringify(versions[key])},`).join('\n');
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `// Généré par scripts/upload-cloudinary.cjs.\nexport const CLOUDINARY_VERSIONS = {\n${entries}\n}\n`);
}
async function uploadFile(filePath, relativePath) {
  const ext = path.extname(relativePath).toLowerCase();
  const publicId = `${BASE_FOLDER}/${relativePath.slice(0, -ext.length)}`;
  const resourceType = VIDEO_EXTENSIONS.has(ext) ? 'video' : RAW_EXTENSIONS.has(ext) ? 'raw' : 'image';
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { invalidate: 'true', overwrite: 'true', public_id: publicId, timestamp };
  const body = new FormData();
  body.append('file', new Blob([fs.readFileSync(filePath)]), path.basename(filePath));
  body.append('api_key', apiKey); body.append('timestamp', String(timestamp));
  body.append('public_id', publicId); body.append('overwrite', 'true'); body.append('invalidate', 'true');
  body.append('signature', signature(params));
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, { method: 'POST', body });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || JSON.stringify(data));
  return data;
}
async function main() {
  if (!fs.existsSync(sourceDir)) throw new Error(`Dossier source introuvable : ${sourceDir}`);
  const files = filesRecursively(sourceDir).filter(file => MEDIA_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const versions = readManifest();
  console.log(`${dryRun ? 'Simulation de ' : ''}${files.length} asset(s) vers Cloudinary/${BASE_FOLDER}`);
  if (dryRun) { files.forEach(file => console.log(`  ${path.relative(sourceDir, file)} -> ${BASE_FOLDER}/${path.relative(sourceDir, file).replace(/\.[^.]+$/, '')}`)); return; }
  let failures = 0;
  for (const file of files) {
    const relative = path.relative(sourceDir, file).replaceAll('\\', '/');
    try { const result = await uploadFile(file, relative); versions[localKey(relative)] = result.version || result.asset_id; console.log(`OK ${relative}`); }
    catch (error) { failures++; console.error(`ECHEC ${relative}: ${error.message}`); }
  }
  writeManifest(versions);
  if (failures) process.exitCode = 1;
}
main().catch(error => { console.error(`Migration interrompue : ${error.message}`); process.exitCode = 1; });
