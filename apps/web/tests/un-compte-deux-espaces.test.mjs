// Un seul compte, deux espaces (patient / professionnel) : « Changer d'espace » réservé aux professionnels, blocage de l'auto-accès.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), "utf8");
const spaces = await import("../src/lib/spaces.ts");

const patientOnly = [{ role: "patient", is_active: true, onboarding_completed: true }];
const doctor = (active) => [
  { role: "patient", is_active: active === "patient", onboarding_completed: true },
  { role: "professional", is_active: active === "professional", onboarding_completed: true },
];

test("le patient simple n'a pas d'entrée « Changer d'espace »", () => {
  assert.equal(spaces.spaceSwitchTarget("patient", patientOnly), null);
  assert.equal(spaces.spaceSwitchTarget("patient", undefined), null);
  assert.equal(spaces.isProfessionalAccount(patientOnly), false);
});

test("un médecin en cours d'inscription (profil non créé) n'a pas encore de second espace", () => {
  const pending = [...patientOnly, { role: "professional", is_active: true, onboarding_completed: false }];
  assert.equal(spaces.spaceSwitchTarget("professional", pending), null);
});

test("un compte professionnel bascule de l'un à l'autre espace, et l'établissement n'en a pas", () => {
  assert.deepEqual(spaces.spaceSwitchTarget("patient", doctor("patient")), { role: "professional", space: "professional", label: "Espace professionnel", href: "/professionnel" });
  assert.deepEqual(spaces.spaceSwitchTarget("professional", doctor("professional")), { role: "patient", space: "patient", label: "Espace patient", href: "/patient" });
  assert.equal(spaces.spaceSwitchTarget("establishment", doctor("professional")), null);
});

test("un lien direct vers l'autre espace active le bon contexte, sans jamais en créer un autre", () => {
  assert.equal(spaces.contextToActivate("patient", doctor("professional")), "patient");
  assert.equal(spaces.contextToActivate("professional", doctor("patient")), "professional");
  assert.equal(spaces.contextToActivate("patient", doctor("patient")), null);
  assert.equal(spaces.contextToActivate("patient", patientOnly), null);
  assert.equal(spaces.contextToActivate("establishment", doctor("patient")), null);
});

test("le menu du compte affiche l'entrée seulement quand la cible existe, et bascule via l'API de contexte", () => {
  const shell = read("src/components/shell/SpaceShell.tsx");
  assert.match(shell, /spaceSwitchTarget\(space, state\.account\.contexts\)/);
  assert.match(shell, /\.\.\.\(switchTarget \? \[\{ id: "switch-space"/);
  assert.match(shell, /Changer d’espace/);
  assert.match(shell, /apiPost\("\/api\/v1\/identity\/contexts\/select\/", \{ role: target\.role \}\)/);
  assert.match(shell, /router\.push\(target\.href\)/);
});

test("le blocage de l'auto-accès est fait côté serveur, avant la consommation du QR, avec audit", () => {
  const services = readFileSync(new URL("../../api/apps/care/services.py", import.meta.url), "utf8");
  const views = readFileSync(new URL("../../api/apps/care/views.py", import.meta.url), "utf8");
  const consultation = readFileSync(new URL("../../api/apps/care/consultation_services.py", import.meta.url), "utf8");
  assert.ok(services.indexOf("raise SelfAccessRefused") > 0 && services.indexOf("raise SelfAccessRefused") < services.indexOf("consume_qr_token(token)\n    return grant"));
  assert.match(services, /espace patient/);
  assert.match(views, /access_grant\.self_refused/);
  assert.match(views, /status=403/);
  assert.match(views, /exclude\(patient__user_id=profile\.user_id\)/);
  assert.match(consultation, /is_own_patient_file\(professional, grant\.patient\)/);
});

test("rien de l'espace professionnel (cachet, signature, rattachements) n'est lu côté patient", () => {
  const patientFiles = ["PatientHome.tsx", "PatientPreconsultations.tsx", "PatientConsultations.tsx", "PatientProfileClient.tsx"];
  for (const name of patientFiles) {
    let source = "";
    try { source = read(`src/components/${name}`); } catch { continue; }
    assert.doesNotMatch(source, /professionals\/me/, `${name} ne doit pas lire le profil professionnel`);
    assert.doesNotMatch(source, /signature_svg|stamp_svg|seal_image/, `${name} ne doit pas lire le cachet ou la signature du médecin connecté`);
  }
});

/* ---------- audit QA du 23/10/2026 ---------- */
const api = (rel) => readFileSync(new URL(`../../api/${rel}`, import.meta.url), "utf8");

test("audit QA : une décision de rattachement ne vaut que pour une demande en attente", () => {
  const views = api("apps/establishments/views.py");
  assert.match(views, /select_for_update\(\)\.filter\(id=membership_id, establishment=establishment, status="pending"\)/);
});

test("audit QA : le plan de suivi passe par la porte clinique (établissement courant, expiration, périmètre)", () => {
  const views = api("apps/care/views.py");
  const start = views.indexOf("class ProfessionalFollowUpPlanCreateView");
  const block = views.slice(start, views.indexOf("class PatientMedicationReminderListCreateView"));
  assert.match(block, /establishment=profile\.active_establishment/);
  assert.match(block, /require_scope\(grant, "consultations"\)/);
  assert.doesNotMatch(block, /status="active"\)\.first\(\)/);
});

test("audit QA : l'API n'est jamais mise en cache par défaut", () => {
  assert.match(api("config/settings.py"), /ApiPrivateNoStoreMiddleware/);
  assert.match(api("apps/identity/middleware.py"), /private, no-store/);
});
