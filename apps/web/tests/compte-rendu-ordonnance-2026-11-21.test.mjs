// Compte rendu de consultation « page de carnet », ligne de signature (cachet de l'établissement, cachet et signature du médecin)
// et ordonnance de l'établissement : structure des composants, branchement des trois espaces, impression et contrat avec l'API.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url).pathname;
const read = (rel) => readFileSync(`${root}${rel}`, "utf8");
const readApi = (rel) => readFileSync(new URL(`../../api/${rel}`, import.meta.url), "utf8");
const records = await import("../src/lib/care-records.ts");

test("la date du carnet s'écrit jj/mm/aa et la référence tient sur 8 caractères, les mêmes à l'écran et dans le PDF", () => {
  assert.equal(records.carnetDate(new Date(2026, 10, 21, 10, 42)), "21/11/26");
  assert.equal(records.consultationReference("7f3a9c21-1111-4222-8333-444455556666"), "7F3A9C21");
  assert.equal(records.consultationReference("abcdef12"), "ABCDEF12");
  // Le calcul côté serveur est le même : tirets retirés, 8 premiers caractères, majuscules.
  assert.match(readApi("apps/care/prescription_context.py"), /str\(consultation\.id\)\.replace\("-", ""\)\[:8\]\.upper\(\)/);
});

test("la carte se présente comme une page du carnet : Dates | Visites, marge de dates, ligne de constantes, lignes pointillées", () => {
  const card = read("src/components/consultation/ConsultationCard.tsx");
  for (const marker of [/consult-card__head/, /Dates/, /Visites/, /consult-card__date/, /consult-vline/, /consult-row/, /consult-rx-block/, /Rp\//]) assert.match(card, marker);
  // Le texte clinique n'est plus dans des tuiles : la grille de constantes de l'ancienne carte a disparu.
  assert.doesNotMatch(card, /consult-vitals__grid/);
  const css = read("src/components/consultation/consultation-card.css");
  assert.match(css, /container: consult \/ inline-size/);
  assert.match(css, /@container consult \(min-width: 520px\)/);
  assert.match(css, /@container consult \(min-width: 780px\)/);
  assert.match(css, /dotted/);
});

test("chaque constante dit qui l'a relevée (patient ou professionnel) sans se fier à la couleur seule", () => {
  const card = read("src/components/consultation/ConsultationCard.tsx");
  assert.match(card, /consult-vline__src--pro/);
  assert.match(card, /consult-vlegend/);
  assert.match(card, /VITAL_SOURCE_LABELS/);
});

test("la ligne de signature a deux emplacements nommés : cachet de l'établissement, puis cachet et signature du médecin", () => {
  const validation = read("src/components/consultation/ConsultationValidation.tsx");
  assert.match(validation, /Cachet de l’établissement/);
  assert.match(validation, /Cachet et signature du médecin/);
  assert.match(validation, /Cachet du médecin/);
  assert.match(validation, /Signature du médecin/);
  assert.match(validation, /Signataire/, "sans image, le médecin est identifié en texte (titre, spécialité, n° d'ordre)");
  // Les images viennent de l'API (figées à la signature) ; l'établissement n'en reçoit pas : un repère « apposé » les remplace.
  assert.match(validation, /sealImageUrl\(id, kind\)/);
  assert.match(validation, /Cachet apposé/);
  assert.match(validation, /Signature apposée/);
  assert.match(validation, /images \? <SealPhoto/);
});

test("le cachet de l'établissement est généré, borné et lisible par un lecteur d'écran", () => {
  const validation = read("src/components/consultation/ConsultationValidation.tsx");
  assert.match(validation, /export function EstablishmentSeal/);
  assert.match(validation, /SEAL_NAME_MAX = 34/);
  assert.match(validation, /role="img"/);
  assert.match(validation, /aria-label=\{`Cachet électronique de/);
  assert.match(validation, /VALIDÉ/);
  assert.match(validation, /useId\(\)/, "deux cachets sur la page ne partagent pas leurs identifiants de tracé");
  const css = read("src/components/consultation/consultation-card.css");
  assert.match(css, /\.consult-valid__seal[^}]*color: var\(--status-measured-fg\)/);
});

test("l'ordonnance : feuille A5 ou A4, aperçu, impression d'une seule feuille, PDF conservé", () => {
  const sheet = read("src/components/prescription/PrescriptionSheet.tsx");
  for (const text of [/Ordonnance médicale/, /Rp\//, /Cachet de l’établissement/, /Cachet du médecin/, /Signature du médecin/, /Prochain rendez-vous/, /Signée électroniquement dans Mon E‑Carnet/]) assert.match(sheet, text);
  assert.match(sheet, /format\?: SheetFormat|format = "a5"/);
  const viewer = read("src/components/prescription/PrescriptionViewer.tsx");
  assert.match(viewer, /apiGet<PrescriptionSheetData>\(sheetHref\)/);
  assert.match(viewer, /role="dialog"/);
  assert.match(viewer, /window\.print\(\)/);
  assert.match(viewer, /Escape/);
  assert.match(viewer, /createPortal/);
  const css = read("src/components/prescription/prescription-sheet.css");
  assert.match(css, /@page rx-a5 \{ size: A5 portrait; margin: 0; \}/);
  assert.match(css, /@page rx-a4 \{ size: A4 portrait; margin: 0; \}/);
  assert.match(css, /body > \*:not\(\.rx-viewer\) \{ display: none !important; \}/);
  assert.match(css, /print-color-adjust: exact/);
});

test("la carte du patient ouvre l'ordonnance affichée et garde le PDF ; les deux autres espaces gardent la carte commune", () => {
  const patient = read("src/components/PatientConsultations.tsx");
  assert.match(patient, /sheetHref=\{`\/api\/v1\/patient\/care\/consultations\/\$\{item\.id\}\/prescription-sheet\/`\}/);
  assert.match(patient, /pdfHref=/);
  assert.match(read("src/components/consultation/ConsultationCard.tsx"), /<PrescriptionViewer/);
  // Un professionnel ou un établissement lit le compte rendu, pas l'ordonnance du patient : pas de bouton qui renverrait 404.
  for (const file of ["ProfessionalConsultations", "EstablishmentPatientRecords"]) assert.doesNotMatch(read(`src/components/${file}.tsx`), /sheetHref=/, file);
});

test("les réglages de l'établissement montrent l'ordonnance telle qu'elle sortira, avec un contenu d'exemple", () => {
  const settings = read("src/components/PrescriptionTemplateSettings.tsx");
  assert.match(settings, /<PrescriptionSheet data=\{sample\} sample \/>/);
  assert.match(settings, /Aperçu de l’ordonnance/);
  // Les champs vides du modèle montrent ce que la fiche de l'établissement fournira (le serveur fait le même repli).
  assert.match(settings, /form\.address \|\| identity\?\.address/);
  assert.match(settings, /placeholder=\{identity\?\.address \|\| undefined\}/);
  assert.match(settings, /URL\.revokeObjectURL/);
  assert.match(read("src/components/EstablishmentSettingsClient.tsx"), /identity=\{\{/);
});

test("contrat avec l'API : feuille d'ordonnance routée, booléens seuls pour les images, aucun identifiant de stockage exposé", () => {
  assert.match(readApi("apps/care/urls.py"), /consultations\/<uuid:pk>\/prescription-sheet\/", PatientPrescriptionSheetView/);
  const serializer = readApi("apps/care/serializers.py");
  const fields = serializer.match(/class ConsultationSerializer[\s\S]*?fields = \(([^)]*)\)/)?.[1] ?? "";
  for (const name of ["has_signature", "has_stamp", "signatory", "establishment"]) assert.match(fields, new RegExp(`"${name}"`), name);
  assert.doesNotMatch(fields, /"signature_asset_id"|"stamp_asset_id"/);
  const context = readApi("apps/care/prescription_context.py");
  assert.match(context, /"has_signature": bool\(consultation\.signature_asset_id\)/);
  assert.match(context, /SAFE_LOGO_PREFIX = "https:\/\/res\.cloudinary\.com\/"/);
});

test("les types du front suivent la réponse de l'API (feuille d'ordonnance, signataire, établissement)", () => {
  const types = read("src/lib/care-records.ts");
  for (const key of ["consultation_id", "reference", "issued_on", "signed_at", "next_appointment", "has_signature", "has_stamp", "order_number", "age_years"]) assert.match(types, new RegExp(key), key);
  const context = readApi("apps/care/prescription_context.py");
  for (const key of ["consultation_id", "reference", "issued_on", "signed_at", "next_appointment", "has_signature", "has_stamp", "order_number", "age_years"]) assert.match(context, new RegExp(`"${key}"`), key);
});
