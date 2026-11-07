// Consultation du médecin par sélection, établissement actif, photos, QR, déconnexion rouge, actualisation au retour de la connexion (07/11/2026).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url).pathname;
const read = (rel) => readFileSync(`${root}${rel}`, "utf8");
const options = await import("../src/lib/consultation-options.ts");

test("les choix cochés gardent l'ordre de la liste, puis le texte libre « Autre » sur une nouvelle ligne", () => {
  assert.equal(options.buildPicked(["Anémie", "Paludisme simple"], options.DIAGNOSES, ""), "Paludisme simple, Anémie");
  assert.equal(options.buildPicked([], options.DIAGNOSES, "  Dengue suspectée "), "Dengue suspectée");
  assert.equal(options.buildPicked(["Paludisme simple"], options.DIAGNOSES, "Dengue"), "Paludisme simple\nDengue");
  assert.equal(options.buildPicked(["inconnu"], options.DIAGNOSES, ""), "", "un choix hors liste n'est jamais enregistré à la place du texte libre");
  assert.deepEqual(options.withCurrent(["a", "b"], "c"), ["c", "a", "b"]);
  assert.deepEqual(options.withCurrent(["a", "b"], "a"), ["a", "b"]);
});

test("ordonnance et examens : des listes pour chaque champ, trois types d'examen, aucun doublon", () => {
  for (const list of [options.DOSAGES, options.POSOLOGIES, options.DURATIONS, options.INSTRUCTIONS, options.DIAGNOSES, options.CARE_PLAN_ITEMS, options.CONCLUSION_ITEMS, options.CLINICAL_FINDINGS]) assert.equal(new Set(list).size, list.length);
  const drugs = options.MEDICATION_GROUPS.flatMap((group) => group.items);
  assert.equal(new Set(drugs).size, drugs.length);
  assert.deepEqual(Object.keys(options.EXAM_CHOICES).sort(), ["analysis", "imaging", "other"]);
  for (const text of [...drugs, ...options.POSOLOGIES, ...Object.values(options.EXAM_CHOICES).flat()]) assert.ok(text.length > 0 && text.length <= 160, text);
});

test("consultation du médecin : le médecin sélectionne comme le patient, sans « Autorisation active »", () => {
  const consultation = read("src/components/ProfessionalConsultations.tsx");
  assert.doesNotMatch(consultation, /Autorisation active|Choisir une autorisation/);
  for (const needle of ["<ChipPicker", "<VitalsPicker", "<PrescriptionPicker", "<ExamPicker", "uploadExamProof", "useProfessionalProfile", "Établissement actif", "PersonAvatar"]) assert.ok(consultation.includes(needle), needle);
  assert.match(consultation, /status === "active" && grant\.scope\.includes\("preconsultation"\)/);
  const parts = read("src/components/consultation/ConsultationParts.tsx");
  assert.match(parts, /symptom-chip/);
  assert.match(parts, /<select value=\{value\[field\.key\]\}/, "mêmes listes que le patient pour poids, taille et température");
  assert.match(parts, /Autre \(préciser\)/);
  const orders = read("src/components/consultation/OrderPickers.tsx");
  for (const label of ["Médicament", "Dosage", "Posologie", "Durée", "Instructions"]) assert.ok(orders.includes(label), label);
  assert.doesNotMatch(orders, /placeholder="Ex\./, "plus de saisie libre pour l'ordonnance");
});

test("examens demandés : photo de la demande comme preuve, envoyée avant la signature et réutilisée en cas de nouvel essai", () => {
  const orders = read("src/components/consultation/OrderPickers.tsx");
  assert.match(orders, /type="file" accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(orders, /Ajouter une photo de la demande/);
  assert.match(read("src/application/professional-access-grants.ts"), /exam-proofs\//);
  assert.match(read("src/components/ProfessionalConsultations.tsx"), /uploadedProofs[\s\S]*WeakMap/);
  assert.match(read("src/lib/image-compress.ts"), /toBlob\(resolve, "image\/jpeg"/);
});

test("rattachements : un seul établissement actif, activé par un bouton ; logos et photos de patient partout", () => {
  const access = read("src/components/ProfessionalAccess.tsx");
  assert.match(access, /Définir comme établissement actif/);
  assert.match(access, /\/api\/v1\/establishments\/active\//);
  const grants = read("src/components/ProfessionalAccessGrants.tsx");
  assert.match(grants, /<PersonAvatar src=\{item\.patient_avatar\}/);
  assert.match(grants, /<EstablishmentLogo logo=\{item\.establishment_logo\}/);
  assert.match(read("src/components/EstablishmentLogo.tsx"), /onError=\{\(\) => setFailed\(true\)\}/, "une image cassée retombe sur les initiales");
  assert.match(read("src/components/ProfessionalSettingsClient.tsx"), /<EstablishmentLogo logo=\{activeEstablishment\.logo\}/);
});

test("déconnexion, révocation, fin de rattachement : boutons rouges et confirmation rouge", () => {
  for (const file of ["src/components/shell/SpaceShell.tsx", "src/components/SettingsDirectory.tsx"]) {
    const source = read(file);
    assert.match(source, /confirmLabel: "Me déconnecter"[^\n]*tone: "danger"/, file);
  }
  assert.match(read("src/app/admin/page.tsx"), /Fermer la session administrateur[\s\S]{0,500}tone: "danger"/);
  assert.match(read("src/components/PatientAccessGrants.tsx"), /className="button primary danger"[^\n]*Révoquer cet accès maintenant/);
  assert.match(read("src/components/ProfessionalAccess.tsx"), /button small primary danger[^\n]*Mettre fin à ce rattachement/);
  assert.match(read("src/components/LinkedProvidersSettingsClient.tsx"), /button small primary danger[^\n]*askUnlink/);
  assert.match(read("src/components/AdminSettingsClient.tsx"), /button primary danger[^\n]*Déconnexion/);
  const css = read("src/app/soft-skin.css");
  assert.match(css, /\.settings-directory > \.setting-item--danger \{ background: var\(--danger\)/);
  assert.match(css, /\.sb__menu-item\.sb__menu-item--danger[^{]*\{ background: var\(--danger\)/);
});

test("retour de la connexion : actualisation automatique, sans effacer une saisie en cours, et nouvel essai de l'espace", () => {
  const provider = read("src/components/network/NetworkProvider.tsx");
  for (const needle of ["refreshKey", "hasUnsavedInput", "MIN_OFFLINE_FOR_REFRESH_MS", "refreshNow"]) assert.ok(provider.includes(needle), needle);
  const banner = read("src/components/network/OfflineBanner.tsx");
  assert.match(banner, /refreshPending \? <button[^>]*onClick=\{refreshNow\}>Actualiser/);
  assert.doesNotMatch(banner, /window\.location\.reload/);
  const shell = read("src/components/shell/SpaceShell.tsx");
  assert.match(shell, /<Fragment key=\{refreshKey\}>\{children\}<\/Fragment>/);
  assert.match(shell, /addEventListener\(NETWORK_RESTORED_EVENT, retry\)/);
  assert.match(shell, /Vous êtes hors connexion" : "Service momentanément indisponible"/);
});

test("copie hors connexion : le profil du médecin tient 7 jours comme la session ; les données de tiers restent à 24 h", async () => {
  const policy = await import("../src/lib/offline-policy.ts");
  const day = 24 * 3600 * 1000;
  assert.equal(policy.cacheTtlMs("/api/v1/professionals/me/"), 7 * day);
  assert.equal(policy.cacheTtlMs("/api/v1/establishments/"), day);
  assert.equal(policy.isCacheablePath("/api/v1/identity/oauth/identities/"), false, "méthodes de connexion liées : jamais copiées");
});
