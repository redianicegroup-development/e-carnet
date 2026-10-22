// Cachet et signature du prescripteur, récupération de compte claire + visible côté admin, liaison Google des établissements.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), "utf8");
const ink = await import("../src/lib/ink-extract.ts");
const notice = await import("../src/components/auth/recoveryNotice.ts");
const google = await import("../src/lib/google-link.ts");

/** Feuille blanche légèrement bruitée de 360×240, avec un trait épais en diagonale (une « signature » synthétique). */
function sheet({ strokes = true } = {}) {
  const width = 360, height = 240;
  const data = new Uint8ClampedArray(width * height * 4);
  let seed = 7;
  const noise = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return (seed / 4294967296) * 10 - 5; };
  for (let i = 0; i < width * height; i++) {
    const shade = 238 + noise();
    data.set([shade, shade, shade - 2, 255], i * 4);
  }
  if (strokes) {
    for (let x = 60; x < 300; x++) {
      const y = Math.round(60 + (x - 60) * 0.5 + Math.sin(x / 14) * 10);
      for (let dy = -3; dy <= 3; dy++) for (let dx = -1; dx <= 1; dx++) data.set([25, 30, 40, 255], ((y + dy) * width + x + dx) * 4);
    }
  }
  return { data, width, height };
}

test("le détourage garde le trait et rend le papier transparent", () => {
  const result = ink.extractInk(sheet(), { sensitivity: 1, color: "original" });
  assert.equal(result.status, "ok");
  const { pixels } = result;
  assert.ok(pixels.width < 360 && pixels.height < 240, "l'image est recadrée sur l'encre");
  assert.equal(ink.hasTransparency(pixels), true);
  let opaque = 0, transparent = 0;
  for (let i = 3; i < pixels.data.length; i += 4) { if (pixels.data[i] > 200) opaque++; else if (pixels.data[i] < 10) transparent++; }
  assert.ok(opaque > 300, "le trait reste net et opaque");
  assert.ok(transparent > pixels.data.length / 4 * 0.3, "le fond est effacé");
  // Les coins du cadrage ne portent plus la teinte du papier.
  assert.ok(pixels.data[3] < 10, "coin haut-gauche transparent");
});

test("la couleur noire ou bleue repeint l'encre d'une seule teinte", () => {
  for (const [color, rgb] of [["black", ink.INK_BLACK], ["blue", ink.INK_BLUE]]) {
    const result = ink.extractInk(sheet(), { sensitivity: 1, color });
    assert.equal(result.status, "ok");
    const { data } = result.pixels;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 200) { assert.deepEqual([data[i], data[i + 1], data[i + 2]], rgb); return; }
    }
    assert.fail("aucun pixel d'encre trouvé");
  }
});

test("une feuille vide n'est pas prise pour une signature", () => {
  assert.equal(ink.extractInk(sheet({ strokes: false }), { sensitivity: 1 }).status, "empty");
});

test("fitWithin réduit sans jamais agrandir", () => {
  const big = ink.fitWithin(4000, 3000, 1000);
  assert.ok(Math.max(big.width, big.height) <= 1000);
  const small = ink.fitWithin(300, 200, 1000);
  assert.deepEqual([small.width, small.height], [300, 200]);
});

test("le cachet et la signature sont proposés dans l'onboarding professionnel, avec « Passer »", () => {
  const onboarding = read("src/components/ProfessionalOnboarding.tsx");
  assert.match(onboarding, /\/professionnel\/onboarding\/ordonnance/);
  assert.ok(existsSync(new URL("src/app/professionnel/onboarding/ordonnance/page.tsx", root)));
  const step = read("src/components/ProfessionalCredentialsOnboarding.tsx");
  assert.match(step, /Passer/);
  assert.match(step, /\/onboarding\/securite/);
  assert.match(read("src/components/ProfessionalCredentialsSettings.tsx"), /InkCapture/);
});

test("la capture accepte la caméra, le dessin et la sélection de la couleur", () => {
  const capture = read("src/components/InkCapture.tsx");
  assert.match(capture, /getUserMedia/);
  assert.match(capture, /extractInk/);
  assert.match(capture, /pointerdown|onPointerDown/);
  assert.match(capture, /"stamp"/);
  assert.match(capture, /"signature"/);
});

test("le cachet et la signature sont apposés à la fin des consultations qui ont une ordonnance", () => {
  assert.match(read("src/components/ProfessionalConsultations.tsx"), /<ConsultationSeal \/>/);
  const seal = read("src/components/ConsultationSeal.tsx");
  assert.match(seal, /useSealImage/);
  assert.match(read("src/components/useSealImage.ts"), /\/api\/v1\/professionals\/credentials\//);
});

test("récupération de compte : essais restants, blocage et réponse acceptée sont dits clairement", () => {
  const wrong = notice.noticeForFailure(400, { code: "wrong_answer", attempts_remaining: 3 });
  assert.match(wrong.message, /3 essais/);
  assert.equal(wrong.tone, "danger");
  const last = notice.noticeForFailure(400, { code: "wrong_answer", attempts_remaining: 1 });
  assert.match(last.message, /seul essai/);
  const locked = notice.noticeForFailure(400, { code: "recovery_locked", retry_after: 900, locked_until: "2026-10-21T10:15:00Z" });
  assert.match(locked.title, /bloquée/);
  assert.equal(locked.primary, "help");
  assert.equal(notice.noticeForFailure(429, {}).primary, "help");
  assert.equal(notice.noticeForFailure(500, {}), null, "une erreur réseau n'est pas une réponse fausse");
  assert.equal(notice.noticeForFailure(400, { code: "validation" }), null);
  assert.equal(notice.acceptedNotice().primary, "password");
  assert.equal(notice.formatWait(900), "15 min");
  assert.equal(notice.formatWait(86400), "24 h");
});

test("la récupération affiche une modal et le suivi est visible dans la console admin", () => {
  const flow = read("src/components/auth/RecoveryFlow.tsx");
  assert.match(flow, /RecoveryNoticeDialog/);
  assert.match(flow, /createPortal/);
  const admin = read("src/app/admin/page.tsx");
  assert.match(admin, /AdminRecoveryClient/);
  assert.match(admin, /recovery/);
  const client = read("src/components/AdminRecoveryClient.tsx");
  assert.match(client, /\/api\/v1\/identity\/admin\/recovery\//);
  assert.match(client, /contact-messages/);
  const urls = readFileSync(new URL("../api/apps/identity/urls.py", root), "utf8");
  assert.match(urls, /admin\/recovery\//);
});

test("liaison Google : démarre seulement pour une adresse Gmail, Google configuré et pas encore lié", () => {
  assert.equal(google.isGoogleAddress("Clinique@Gmail.com"), true);
  assert.equal(google.isGoogleAddress("x@googlemail.com"), true);
  assert.equal(google.isGoogleAddress("x@clinique.cm"), false);
  assert.equal(google.isGoogleAddress(""), false);
  const account = { email: "clinique@gmail.com", auth_identities: [] };
  assert.equal(google.shouldAutoLinkGoogle(account, true), true);
  assert.equal(google.shouldAutoLinkGoogle(account, false), false, "Google non configuré : on ne redirige pas vers une erreur");
  assert.equal(google.shouldAutoLinkGoogle({ ...account, auth_identities: [{ provider: "google" }] }, true), false);
  assert.equal(google.shouldAutoLinkGoogle(null, true), false);
  const url = google.googleLinkUrl("/onboarding/securite");
  assert.match(url, /intent=link/);
  assert.match(url, /next=%2Fonboarding%2Fsecurite/);
});

test("la fiche établissement lance la liaison Google après l'enregistrement", () => {
  const form = read("src/components/EstablishmentProfileForm.tsx");
  assert.match(form, /shouldAutoLinkGoogle/);
  assert.match(form, /oauth\/providers\//);
  assert.match(form, /googleLinkUrl\(after\)/);
  assert.match(form, /router\.push\(after\)/);
  assert.match(read("src/components/LinkedProvidersSettingsClient.tsx"), /returnedMessage/);
});
