import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

test("Paramètres de l'établissement → Facturation, jamais pour un laboratoire", () => {
  const settings = read("components/EstablishmentSettingsClient.tsx");
  assert.match(settings, /id: "facturation", title: "Facturation"/);
  assert.match(settings, /<EstablishmentBilling key=\{selected\.id\} establishmentId=\{selected\.id\} \/>/);
  assert.match(settings, /item\.id !== "facturation"/);
  assert.match(settings, /if \(status === "suspended"\) return "Suspendu"/);
});

test("le navigateur ne déclare jamais une facture payée", () => {
  const billing = read("components/EstablishmentBilling.tsx");
  assert.match(billing, /billing\/invoices\/\$\{invoice\.id\}\/pay\//);
  assert.doesNotMatch(billing, /confirm-payment|setPaid|\.status\s*=\s*"paid"/);
  assert.match(billing, /confirmation par notre équipe|confirmation vient du serveur|Le paiement est confirmé côté serveur|confirmation/);
  assert.match(billing, /Le patient ne paie jamais/);
});

test("la console équipe exige une référence de transaction et reste réservée au personnel", () => {
  const admin = read("components/AdminBillingClient.tsx");
  assert.match(admin, /Référence de la transaction \(obligatoire\)[\s\S]*required/);
  assert.match(admin, /confirm-payment/);
  assert.match(read("app/admin/page.tsx"), /AdminBillingClient/);
});

test("la suspension annoncée rassure sur le carnet du patient", () => {
  assert.match(read("components/AdminBillingClient.tsx"), /les patients gardent leur carnet/);
});
