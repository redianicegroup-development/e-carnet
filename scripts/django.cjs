const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const apiDirectory = path.join(root, "apps", "api");
const localPythonCandidates = [
  path.join(apiDirectory, ".venv", "bin", "python"),
  path.join(apiDirectory, ".venv", "Scripts", "python.exe"),
].filter((candidate) => fs.existsSync(candidate));
const python = localPythonCandidates[0] ?? process.env.PYTHON ?? (process.platform === "win32" ? "python" : "python3");
const env = { ...process.env };
const djangoCommand = process.argv[2];

// Django needs a SECRET_KEY even for tests/checks; this key is never used for application service commands.
if (!env.DJANGO_SECRET_KEY && (djangoCommand === "test" || djangoCommand === "check")) {
  env.DJANGO_SECRET_KEY = "test-only-not-a-secret";
}
// L'application démarre en mode production par défaut (DJANGO_DEBUG=false). Ce script est réservé au poste local :
// s'il n'y a ni clé ni réglage explicite, on active le mode debug pour le développement uniquement.
if (env.DJANGO_DEBUG === undefined && !env.DJANGO_SECRET_KEY) {
  env.DJANGO_DEBUG = "true";
}
if (env.DJANGO_DEBUG === undefined && djangoCommand === "test") {
  env.DJANGO_DEBUG = "true";
}

const result = spawnSync(python, ["manage.py", ...process.argv.slice(2)], {
  cwd: apiDirectory,
  stdio: "inherit",
  env,
});

if (result.error) {
  console.error(`Impossible de lancer Django avec « ${python} » : ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
