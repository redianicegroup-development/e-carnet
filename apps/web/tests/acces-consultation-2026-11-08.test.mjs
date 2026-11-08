// Scan → consultation du patient, cartes « Mes demandes » uniformes, fin d'accès à la signature, bienvenue centré (gooey).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

test("le scan réussi ouvre l'accès sans second clic et mène droit à la consultation du patient", () => {
  const tsx = read("src/components/ProfessionalAccessGrants.tsx");
  // Lecture du QR → ouverture immédiate.
  assert.match(tsx, /function onScanned\(token: string\) \{[^}]*void openAccess\(token\);/);
  // Un seul envoi à la fois (double lecture caméra, double clic).
  assert.match(tsx, /const opening = useRef\(false\)/);
  assert.match(tsx, /if \(opening\.current\) return;/);
  // Accès actif → page « Suivi » avec le patient désigné.
  assert.match(tsx, /const CONSULTATION_PATH = "\/professionnel\/consultations"/);
  assert.match(tsx, /created\.status === "active"[\s\S]*router\.push\(`\$\{CONSULTATION_PATH\}\?acces=\$\{encodeURIComponent\(created\.id\)\}`\)/);
  // Échec : le QR reste lu, le bouton « Ouvrir l'accès » sert à réessayer et l'erreur est visible près du bouton.
  assert.match(tsx, /\{formError && <p className="status" role="alert">\{formError\}<\/p>\}/);
  assert.match(tsx, /Ouvrir l’accès/);
});

test("la page Suivi ouvre le patient scanné, retire le paramètre de l'adresse et sort le patient signé de la liste", () => {
  const tsx = read("src/components/ProfessionalConsultations.tsx");
  assert.match(tsx, /new URLSearchParams\(window\.location\.search\)\.get\("acces"\)/);
  assert.match(tsx, /window\.history\.replaceState\(null, "", window\.location\.pathname\)/);
  assert.match(tsx, /usable\.find\(\(grant\) => grant\.id === scanned\)/);
  assert.match(tsx, /id="terminer-consultation"/);
  // L'accès se ferme à la signature : le patient disparaît des patients connectés et le médecin en est informé avant de signer.
  assert.match(tsx, /setGrants\(\(current\) => current\.filter\(\(grant\) => grant\.id !== signedGrantId\)\)/);
  assert.match(tsx, /votre accès à son carnet se fermera automatiquement/);
});

test("« Mes demandes » : toutes les cartes sont des rectangles identiques", () => {
  const css = read("src/components/consultation-flow.css");
  const tsx = read("src/components/ProfessionalAccessGrants.tsx");
  const card = css.match(/\.record\.request-row \{[^}]*\}/)?.[0] ?? "";
  assert.match(card, /display: grid/);
  assert.match(card, /min-height: \d+px/);
  assert.match(card, /grid-template-rows: auto minmax\(2\.7em, 1fr\) minmax\(64px, auto\)/);
  assert.match(css, /\.request-row__who strong, \.request-row__facility \{[^}]*text-overflow: ellipsis[^}]*white-space: nowrap/);
  assert.match(css, /\.request-row__scope \{[^}]*-webkit-line-clamp: 2/);
  assert.match(css, /\.request-list \{[^}]*display: grid[^}]*repeat\(auto-fill/);
  // Plus de colonne latérale qui écrase le texte : trois zones (identité, périmètre, pied) dans chaque carte, quel que soit le statut.
  assert.doesNotMatch(css, /request-row__side/);
  assert.match(tsx, /className="request-list"/);
  assert.match(tsx, /request-row__who[\s\S]*request-row__scope[\s\S]*request-row__foot/);
});

test("le message de bienvenue est centré au milieu de l'écran, sur PC comme sur mobile, avec la goutte gooey née en son centre", () => {
  const modal = read("src/components/modal/modal.css");
  const stage = modal.match(/\.greeting-stage \{[^}]*\}/)?.[0] ?? "";
  assert.match(stage, /top: 0; bottom: 0; left: 0; right: 0/);
  assert.match(stage, /display: flex; justify-content: center; align-items: center/);
  assert.match(stage, /pointer-events: none/); // toujours non bloquant
  // Le mobile ne décale plus la scène vers le haut.
  const mobile = modal.slice(modal.indexOf("@media (max-width: 520px) { .greeting-toast"));
  assert.ok(mobile.startsWith("@media (max-width: 520px) { .greeting-toast"));
  assert.doesNotMatch(modal, /@media \(max-width: 520px\) \{ \.greeting-stage/);
  const goo = read("src/app/goo.css");
  assert.match(goo, /body \.greeting-stage \.goo-layer__blob \{ animation-name: goo-blob-grow-center; \}/);
  assert.match(goo, /@keyframes goo-blob-grow-center/);
  assert.match(goo, /body \.greeting-toast \{ transform-origin: 50% 50%; \}/);
  // Mouvement réduit : la goutte reste masquée, mêmes états finaux.
  assert.match(goo, /prefers-reduced-motion: reduce\) \{\s*body \.goo-layer \{ display: none; \}/);
  // La goutte suit la carte quand l'écran tourne ou se redimensionne.
  assert.match(read("src/components/ui/GooLayer.tsx"), /window\.addEventListener\("resize", sync\)/);
});
