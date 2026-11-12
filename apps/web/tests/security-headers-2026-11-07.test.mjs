import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");

test("SEC-01 : les pages web posent les en-têtes de sécurité de base", () => {
  assert.match(config, /async headers\(\)/);
  for (const header of ["X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy", "Cross-Origin-Opener-Policy", "Strict-Transport-Security"]) {
    assert.ok(config.includes(`"${header}"`), `${header} manquant`);
  }
  assert.match(config, /"nosniff"/);
  assert.match(config, /"DENY"/);
  assert.match(config, /poweredByHeader: false/);
});

test("SEC-01 : la caméra reste autorisée pour le scanner QR, le reste est coupé", () => {
  const policy = config.match(/"Permissions-Policy", value: "([^"]+)"/)?.[1] ?? "";
  assert.match(policy, /camera=\(self\)/);
  for (const feature of ["microphone", "geolocation", "payment", "usb"]) assert.ok(policy.includes(`${feature}=()`), `${feature} devrait être coupé`);
});

test("SEC-01 : la CSP démarre en Report-Only, sans rien bloquer, et peut basculer en bloquant par variable", () => {
  assert.match(config, /Content-Security-Policy-Report-Only/);
  assert.match(config, /ECARNET_CSP_ENFORCE/);
  assert.match(config, /ECARNET_CSP_REPORT_URI/);
  assert.match(config, /"frame-ancestors 'none'"/);
  assert.match(config, /"object-src 'none'"/);
  assert.match(config, /"connect-src 'self'[^"]*"/);
});

test("SEC-01 / SEC-07 : HSTS d'un an côté web, seulement en production", () => {
  assert.match(config, /ECARNET_HSTS_SECONDS \|\| 31536000/);
  assert.match(config, /isProduction \? \[\{ key: "Strict-Transport-Security"/);
});

test("SEC-07 : HSTS d'un an par défaut côté API", () => {
  const settings = readFileSync(new URL("../../api/config/settings.py", import.meta.url), "utf8");
  assert.match(settings, /DJANGO_HSTS_SECONDS", str\(60 \* 60 \* 24 \* 365\)/);
  assert.doesNotMatch(settings, /DJANGO_HSTS_SECONDS", "86400"/);
});
