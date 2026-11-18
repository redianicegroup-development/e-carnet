// Mode invité (16-17/11/2026) : tuile côté professionnel, bouton côté patient, confirmation des consultations écrites sur le téléphone du
// patient, mode d'accès dans le sceau, téléphone et date de naissance obligatoires à l'onboarding.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

test("l'accueil professionnel a une tuile « Mode invité » à côté de « Mes consultations »", () => {
  const source = read("src/components/ProfessionalConsultations.tsx");
  assert.match(source, /title="Mes consultations"[\s\S]*<\/CollapsibleSection><CollapsibleSection title="Mode invité" icon="idcard" hint="Patient sans téléphone"><ProfessionalGuestAccess onReady=\{openGuestGrant\} \/>/);
});

test("le mode invité du professionnel ne laisse jamais le profil seul : comparaison avec la personne présente avant l'accès", () => {
  const source = read("src/components/ProfessionalGuestAccess.tsx");
  assert.match(source, /lookupGuestPatient[\s\S]*setStep\("compare"\)/);
  assert.match(source, /Comparez ce profil avec la personne qui se trouve devant vous/);
  assert.match(source, /startGuestAccess\(found\.confirmation_token\)/);
  assert.match(source, /Ce n’est pas elle/);
  assert.match(source, /createGuestPreconsultation\(grant\.id/);
});

test("l'espace patient a un petit bouton « Mode invité » à droite de l'étape 1", () => {
  const source = read("src/components/PatientConsultationFlow.tsx");
  assert.match(source, /<span className="eyebrow">Étape 1<\/span>\s*<button[^>]*onClick=\{\(\) => setGuestOpen[\s\S]*Mode invité<\/button>/);
  assert.match(source, /\{guestOpen && <PatientGuestProfessional /);
  assert.match(source, /<PatientGuestConsultations refreshKey=\{guestRefresh\} \/>/);
});

test("côté patient, le médecin est identifié puis la consultation est enregistrée SANS signature, en attente", () => {
  const source = read("src/components/PatientGuestProfessional.tsx");
  assert.match(source, /lookupGuestProfessional[\s\S]*setStep\("compare"\)/);
  assert.match(source, /C’est bien ce médecin/);
  assert.match(source, /Enregistrer en attente de confirmation/);
  assert.match(source, /Rien n’est signé ici/);
  assert.doesNotMatch(source, /attestation_svg|ConsultationSeal/, "aucune signature n'est saisie sur le téléphone du patient");
});

test("le patient voit ces consultations comme non signées, jamais comme validées", () => {
  const source = read("src/components/PatientGuestConsultations.tsx");
  assert.match(source, /En attente de confirmation/);
  assert.match(source, /Elle n’est pas signée/);
  assert.match(source, /rejected:[\s\S]*Non confirmée/);
  assert.match(source, /expired:[\s\S]*jamais été signée/);
});

test("le médecin relit chaque consultation dans le formulaire habituel, prérempli, et la signe avec la saisie en attente", () => {
  const source = read("src/components/ProfessionalConsultations.tsx");
  assert.match(source, /<ProfessionalGuestToConfirm items=\{guestItems\}/);
  assert.match(source, /function reviewGuest[\s\S]*setClinical\(\{ selected: \[\], other: draft\.clinical_exam/);
  assert.match(source, /guest_consultation_id: guestPending\.id/);
  assert.match(source, /Quitter la relecture/);
  assert.match(source, /!pending && !guestPending && <button[\s\S]*?waitResults/, "pas d'attente de résultats sur un accès fermé");
  assert.match(source, /const selectedGrant = guestPending \? null :/, "pas de saisie de mesure pendant la relecture");
  assert.match(read("src/components/ProfessionalGuestToConfirm.tsx"), /Je ne la reconnais pas/);
});

test("le sceau montre le mode d'accès et le moment de rédaction", () => {
  const seal = read("src/components/ConsultationSealPanel.tsx");
  assert.match(seal, /guest_pro: "Mode invité · rédigée sur le téléphone du patient"/);
  assert.match(seal, /<dt>Mode d’accès<\/dt>/);
  assert.match(seal, /item\.drafted_at && <div><dt>Rédigée le<\/dt>/);
  assert.match(read("src/lib/care-records.ts"), /access_mode\?: "qr" \| "guest" \| "guest_pro";[\s\S]*drafted_at\?: string \| null;/);
});

test("le téléphone et la date de naissance sont obligatoires à l'onboarding", () => {
  const fields = read("src/components/PatientIdentityFields.tsx");
  assert.match(fields, /La date de naissance est obligatoire\./);
  assert.match(fields, /Le numéro de téléphone est obligatoire \(8 chiffres au minimum\)\./);
  assert.match(fields, /<span>Téléphone<\/span><input required type="tel"/);
  assert.match(fields, /<span>Date de naissance<\/span><input required type="date"/);
  assert.match(read("src/components/PatientOnboarding.tsx"), /La ville, la date de naissance et le téléphone sont obligatoires/);
});

test("les appels du mode invité visent les routes du serveur", () => {
  const api = read("src/application/guest-access.ts");
  for (const route of ["/guest-access/lookup/", "/guest-access/start/", "/guest-preconsultation/", "/guest-professional/lookup/", "/guest-professional/start/", "/guest-professional/${grantId}/consultation/", "/guest-consultations/`", "/guest-consultations/${id}/reject/"]) {
    assert.ok(api.includes(route), route);
  }
});
