#!/usr/bin/env node
'use strict';
/* Envoi des visuels et PDF de apps/web/public vers Cloudinary — « tri puis envoi » (15/11/2026).

   Avant, chaque exécution renvoyait TOUT (overwrite). Maintenant le script :
     1. liste ce qui est déjà sur Cloudinary sous CLOUDINARY_BASE_FOLDER (API Admin, paginée) ;
     2. compare avec les fichiers locaux (même identifiant public que l'envoi) ;
     3. n'envoie QUE ceux qui n'y sont pas ;
     4. remet à jour apps/web/src/data/cloudinaryVersions.js pour tous (versions lues sur Cloudinary pour les fichiers déjà présents).

   Options
     --dry-run   montre le tri (déjà présents / à envoyer) sans rien envoyer ni écrire
     --update    envoie aussi les fichiers déjà présents dont la taille diffère de celle de Cloudinary (image remplacée sous le même nom)
     --force     ancien comportement : tout renvoyer (overwrite), sans consulter Cloudinary
     --help      rappel d'usage

   Sans --update, un fichier déjà présent n'est jamais renvoyé, même s'il a changé en local : le tri signale ceux dont la taille diffère. */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const projectRoot = path.join(__dirname, '..');
const MEDIA_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif', '.webm', '.mp4', '.mov']);
const VIDEO_EXTENSIONS = new Set(['.webm', '.mp4', '.mov']);
const RAW_EXTENSIONS = new Set(['.pdf', '.svg']);
const RESOURCE_TYPES = ['image', 'video', 'raw'];

/** Les variables déjà injectées par le shell ou la plateforme de production restent prioritaires. */
function loadEnvFiles() {
  const envFiles = [
    '.env.production.local', 'apps/api/.env.production.local', 'apps/web/.env.production.local',
    '.env.production', 'apps/api/.env.production', 'apps/web/.env.production',
    '.env.local', 'apps/api/.env.local', 'apps/web/.env.local',
    '.env', 'apps/api/.env', 'apps/web/.env',
  ];
  for (const relativePath of envFiles) {
    const envPath = path.join(projectRoot, relativePath);
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
}

function resourceTypeFor(ext) {
  return VIDEO_EXTENSIONS.has(ext) ? 'video' : RAW_EXTENSIONS.has(ext) ? 'raw' : 'image';
}
function publicIdFor(relativePath, baseFolder) {
  const ext = path.extname(relativePath).toLowerCase();
  return `${baseFolder}/${relativePath.slice(0, -ext.length)}`;
}
const remoteKey = (resourceType, publicId) => `${resourceType}:${publicId}`;
const localKey = relativePath => `/${relativePath.replaceAll('\\', '/')}`;

function filesRecursively(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesRecursively(full) : [full];
  });
}

/** Liste tout ce qui est déjà sous `baseFolder` : Map « type:public_id » → { version, bytes }. */
async function listRemote({ cloudName, apiKey, apiSecret, baseFolder }, fetchImpl = fetch) {
  const auth = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;
  const found = new Map();
  for (const resourceType of RESOURCE_TYPES) {
    let cursor = '';
    do {
      const query = new URLSearchParams({ prefix: `${baseFolder}/`, max_results: '500' });
      if (cursor) query.set('next_cursor', cursor);
      const response = await fetchImpl(`https://api.cloudinary.com/v1_1/${cloudName}/resources/${resourceType}/upload?${query}`, { headers: { Authorization: auth } });
      const data = await response.json();
      if (!response.ok) throw new Error(`liste Cloudinary (${resourceType}) : ${data.error?.message || response.status}`);
      for (const item of data.resources || []) found.set(remoteKey(resourceType, item.public_id), { version: item.version, bytes: item.bytes });
      cursor = data.next_cursor || '';
    } while (cursor);
  }
  return found;
}

/** Le tri. `files` : [{ relative, size }] ; `remote` : Map de listRemote. Renvoie ce qui est à envoyer et ce qui est déjà présent. */
function planUploads(files, remote, baseFolder, { force = false, update = false } = {}) {
  const toUpload = [];
  const present = [];
  const sizeDiffers = [];
  for (const file of files) {
    const ext = path.extname(file.relative).toLowerCase();
    const known = remote.get(remoteKey(resourceTypeFor(ext), publicIdFor(file.relative, baseFolder)));
    if (force || !known) { toUpload.push({ ...file, reason: force ? 'forcé' : 'absent de Cloudinary' }); continue; }
    const differs = typeof known.bytes === 'number' && known.bytes !== file.size;
    if (differs) sizeDiffers.push(file.relative);
    if (differs && update) toUpload.push({ ...file, reason: 'taille différente' });
    else present.push({ ...file, version: known.version });
  }
  return { toUpload, present, sizeDiffers };
}

function readManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) return {};
  const source = fs.readFileSync(manifestPath, 'utf8');
  const match = source.match(/export const CLOUDINARY_VERSIONS = (\{[\s\S]*\})\s*$/);
  if (!match) return {};
  try { return Function(`"use strict"; return (${match[1]})`)(); } catch { return {}; }
}
function writeManifest(manifestPath, versions) {
  const entries = Object.keys(versions).sort().map(key => `  ${JSON.stringify(key)}: ${JSON.stringify(versions[key])},`).join('\n');
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `// Généré par scripts/upload-cloudinary.cjs.\nexport const CLOUDINARY_VERSIONS = {\n${entries}\n}\n`);
}

async function uploadFile(config, filePath, relativePath) {
  const { cloudName, apiKey, apiSecret, baseFolder } = config;
  const ext = path.extname(relativePath).toLowerCase();
  const publicId = publicIdFor(relativePath, baseFolder);
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { invalidate: 'true', overwrite: 'true', public_id: publicId, timestamp };
  const signature = crypto.createHash('sha1')
    .update(Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&') + apiSecret).digest('hex');
  const body = new FormData();
  body.append('file', new Blob([fs.readFileSync(filePath)]), path.basename(filePath));
  body.append('api_key', apiKey); body.append('timestamp', String(timestamp));
  body.append('public_id', publicId); body.append('overwrite', 'true'); body.append('invalidate', 'true');
  body.append('signature', signature);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceTypeFor(ext)}/upload`, { method: 'POST', body });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || JSON.stringify(data));
  return data;
}

async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help')) { console.log('Usage : node scripts/upload-cloudinary.cjs [--dry-run] [--update] [--force]'); return; }
  const dryRun = argv.includes('--dry-run');
  const force = argv.includes('--force');
  const update = argv.includes('--update');

  loadEnvFiles();
  const config = {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    baseFolder: process.env.CLOUDINARY_BASE_FOLDER || 'e-carnet/project',
  };
  if (!config.cloudName || !config.apiKey || !config.apiSecret) {
    console.error('CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY et CLOUDINARY_API_SECRET sont requis.');
    process.exitCode = 1;
    return;
  }
  const sourceDir = path.resolve(process.env.CLOUDINARY_SOURCE_DIR || path.join(projectRoot, 'apps', 'web', 'public'));
  const manifestPath = path.join(projectRoot, 'apps', 'web', 'src', 'data', 'cloudinaryVersions.js');
  if (!fs.existsSync(sourceDir)) throw new Error(`Dossier source introuvable : ${sourceDir}`);

  const files = filesRecursively(sourceDir)
    .filter(file => MEDIA_EXTENSIONS.has(path.extname(file).toLowerCase()))
    .map(file => ({ file, relative: path.relative(sourceDir, file).replaceAll('\\', '/'), size: fs.statSync(file).size }));

  let remote = new Map();
  if (!force) {
    console.log(`Consultation de Cloudinary/${config.baseFolder}…`);
    remote = await listRemote(config);
    console.log(`${remote.size} asset(s) déjà sur Cloudinary.`);
  }
  const plan = planUploads(files, remote, config.baseFolder, { force, update });
  console.log(`${files.length} fichier(s) local(aux) : ${plan.present.length} déjà sur Cloudinary (ignorés), ${plan.toUpload.length} à envoyer.`);
  if (plan.sizeDiffers.length && !update) {
    console.log(`Attention : ${plan.sizeDiffers.length} fichier(s) déjà présent(s) ont une taille différente (remplacés en local ?). Relancer avec --update pour les renvoyer :`);
    plan.sizeDiffers.forEach(relative => console.log(`  ≠ ${relative}`));
  }
  if (dryRun) {
    plan.toUpload.forEach(item => console.log(`  + ${item.relative} -> ${publicIdFor(item.relative, config.baseFolder)} (${item.reason})`));
    console.log('Simulation : rien n\'a été envoyé ni écrit.');
    return;
  }

  // Manifeste : les versions des fichiers déjà présents viennent de Cloudinary (rien n'est renvoyé), celles des envois, de la réponse.
  const versions = readManifest(manifestPath);
  for (const item of plan.present) if (item.version) versions[localKey(item.relative)] = item.version;
  let failures = 0;
  for (const item of plan.toUpload) {
    try {
      const result = await uploadFile(config, item.file, item.relative);
      versions[localKey(item.relative)] = result.version || result.asset_id;
      console.log(`OK ${item.relative}`);
    } catch (error) {
      failures++;
      console.error(`ECHEC ${item.relative}: ${error.message}`);
    }
  }
  writeManifest(manifestPath, versions);
  if (failures) process.exitCode = 1;
}

module.exports = { listRemote, planUploads, publicIdFor, resourceTypeFor, remoteKey };

if (require.main === module) {
  main().catch(error => { console.error(`Migration interrompue : ${error.message}`); process.exitCode = 1; });
}
