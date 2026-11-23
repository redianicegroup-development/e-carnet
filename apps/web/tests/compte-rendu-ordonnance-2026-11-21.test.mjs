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
  // Modèle simple d'une ordonnance papier : logo, en-tête, coordonnées ; nom du patient ; titre encadré ; médicaments ; signature du professionnel et cachet de l'établissement.
  for (const text of [/Ordonnance médicale/, /Nom du patient/, /Signature du professionnel/, /Cachet de l’établissement/, /Signée électroniquement dans Mon E‑Carnet/, /establishmentStampSrc/, /establishmentSignatureSrc/]) assert.match(sheet, text);
  for (const gone of [/Rp\//, /Prochain rendez-vous/, /age_years|patient\.sex|patient\.weight/]) assert.doesNotMatch(sheet, gone);
  assert.match(sheet, /format\?: SheetFormat|format = "a5"/);
  const viewer = read("src/components/prescription/PrescriptionViewer.tsx");
  assert.match(viewer, /apiGet<PrescriptionSheetData>\(sheetHref\)/);
  assert.match(viewer, /sealImageUrl\(state\.data\.consultation_id, "establishment-stamp"\)/);
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
  assert.match(settings, /<PrescriptionSheet data=\{sample\} sample /);
  assert.match(settings, /Aperçu de l’ordonnance/);
  // Le modèle ne garde que l'en-tête et le pied de page : le reste vient de la fiche de l'établissement (le serveur lit la même fiche).
  assert.match(settings, /address: identity\?\.address/);
  assert.match(settings, /logo_url: identity\?\.logo/);
  assert.match(settings, /header_text/);
  assert.match(settings, /footer_text/);
  for (const gone of [/Logo de l’établissement/, /<span>Adresse<\/span>/, /<span>Téléphone<\/span>/, /<span>Email<\/span>/, /apiUploadPatch/]) assert.doesNotMatch(settings, gone);
  // L'exemple d'en-tête s'adapte au type de structure.
  assert.match(settings, /export function headerExample/);
  assert.match(read("src/components/EstablishmentSettingsClient.tsx"), /identity=\{\{/);
});

test("contrat avec l'API : feuille d'ordonnance routée, booléens seuls pour les images, aucun identifiant de stockage exposé", () => {
  assert.match(readApi("apps/care/urls.py"), /consultations\/<uuid:pk>\/prescription-sheet\/", PatientPrescriptionSheetView/);
  const serializer = readApi("apps/care/serializers.py");
  const fields = serializer.match(/class ConsultationSerializer[\s\S]*?fields = \(([^)]*)\)/)?.[1] ?? "";
  for (const name of ["has_signature", "has_stamp", "has_establishment_stamp", "has_establishment_signature", "signatory", "establishment"]) assert.match(fields, new RegExp(`"${name}"`), name);
  assert.doesNotMatch(fields, /"signature_asset_id"|"stamp_asset_id"|"establishment_stamp_asset_id"|"establishment_signature_asset_id"/);
  const context = readApi("apps/care/prescription_context.py");
  assert.match(context, /"has_signature": bool\(consultation\.signature_asset_id\)/);
  assert.match(context, /"has_establishment_stamp": bool\(consultation\.establishment_stamp_asset_id\)/);
  // La feuille ne lit plus le modèle que pour l'en-tête et le pied de page : le reste vient de la fiche de l'établissement.
  assert.doesNotMatch(context, /template\.(phone|email|address|logo_url)/);
});

test("les types du front suivent la réponse de l'API (feuille d'ordonnance, signataire, établissement)", () => {
  const types = read("src/lib/care-records.ts");
  const keys = ["consultation_id", "reference", "issued_on", "signed_at", "has_signature", "has_stamp", "has_establishment_stamp", "has_establishment_signature", "order_number"];
  for (const key of keys) assert.match(types, new RegExp(key), key);
  const context = readApi("apps/care/prescription_context.py");
  for (const key of keys) assert.match(context, new RegExp(`"${key}"`), key);
  // Modèle simple : le patient n'apparaît que par son nom, et plus de prochain rendez-vous sur la feuille.
  for (const gone of ["next_appointment", "age_years"]) {
    assert.doesNotMatch(types, new RegExp(gone), gone);
    assert.doesNotMatch(context, new RegExp(`"${gone}"`), gone);
  }
});

test("cachet et signature de l'établissement : déposés dans « Informations administratives », figés à la validation, lus dans les consultations et l'ordonnance", () => {
  const editor = read("src/components/EstablishmentProfileEditor.tsx");
  assert.match(editor, /useEstablishmentSealsDraft/);
  assert.match(editor, /<EstablishmentSealFields draft=\{seals\} \/>/);
  assert.match(editor, /scope === "identity" && !lab/, "le cachet et la signature ne se règlent que dans les informations administratives d'un établissement (pas un laboratoire)");
  const seals = read("src/components/EstablishmentSeals.tsx");
  assert.match(seals, /\/api\/v1\/establishments\/\$\{establishmentId\}\/credentials/);
  assert.match(seals, /Les consultations et ordonnances déjà signées gardent ce qui y figurait/);
  // Même geste que chez le professionnel : le même champ « aperçu + Ajouter / Remplacer / Retirer », avec ses libellés propres.
  assert.match(read("src/components/ProfessionalCredentialsSettings.tsx"), /export function SealField/);
  assert.match(read("src/components/ProfessionalCredentialsSettings.tsx"), /ESTABLISHMENT_SEAL_COPY/);
  // Dans la consultation : le scan figé remplace le cachet électronique, qui reste le repli (anciennes consultations, espace établissement).
  const validation = read("src/components/consultation/ConsultationValidation.tsx");
  assert.match(validation, /kind="establishment-stamp"/);
  assert.match(validation, /kind="establishment-signature"/);
  assert.match(validation, /Signature de l’établissement/);
  assert.match(validation, /<EstablishmentSeal name=\{establishmentName\}/);
  assert.match(read("src/components/ConsultationSealPanel.tsx"), /"establishment-stamp" \| "establishment-signature"/);
  // Côté serveur : routes réservées à l'administrateur de CETTE structure, identifiants jamais exposés.
  const urls = readApi("apps/establishments/urls.py");
  assert.match(urls, /<uuid:establishment_id>\/credentials\/<slug:kind>\//);
  const views = readApi("apps/establishments/credential_views.py");
  assert.match(views, /active_administrator\(request\.user, establishment_id\)/);
  assert.match(views, /delivery_type="private"/);
  assert.match(readApi("apps/care/views.py"), /"establishment-stamp": "establishment_stamp_asset_id"/);
});
