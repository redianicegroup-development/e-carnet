import { test, expect, devices, type Browser, type Page } from "@playwright/test";

type Encounter = {
  id: string;
  reason: string;
  observations: string;
  status: "draft" | "closed";
  closed_at: string | null;
  facility_label: string;
  establishment_id: string | null;
  recorded_with_help: string;
  preconsultation_template: string | null;
  template_fields: unknown[];
  template_responses: Record<string, unknown>;
  vitals: Record<string, unknown>;
  provenance: { label: string };
};

const fakeAccount = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "patiente@example.test",
  first_name: "Patiente",
  last_name: "Démo",
  avatar_url: "",
  contexts: [{ role: "patient", is_active: true, onboarding_completed: true }],
  patient_profile: { completed: true, id: "20000000-0000-4000-8000-000000000001" },
};

function envelope(data: unknown) {
  return { success: true, data };
}

function fakeEncounter(id = "30000000-0000-4000-8000-000000000001", reason = "Consultation de démonstration"): Encounter {
  return {
    id,
    reason,
    observations: "",
    status: "draft",
    closed_at: null,
    facility_label: "",
    establishment_id: null,
    recorded_with_help: "",
    preconsultation_template: null,
    template_fields: [],
    template_responses: {},
    vitals: {},
    provenance: { label: "Saisie de démonstration" },
  };
}

function fakeEmergencyCard() {
  return {
    first_name: "Patiente",
    last_name: "Démo",
    city: "Ville de test",
    blood_group: "",
    height_cm: "",
    weight_kg: "",
    allergies: [],
    treatments: [],
    contact_name: "Contact fictif",
    contact_phone: "00000000",
    declarations_provenance: {},
  };
}

async function installSyntheticApi(page: Page, options: { draft?: Encounter | null; simulateLostCreateResponse?: boolean } = {}) {
  let draft = options.draft ?? null;
  let lostCreateResponse = false;
  let createRequests = 0;
  let updateRequests = 0;
  let simulateOffline = false;

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

    if (path === "/api/v1/health/ready/" || path === "/api/v1/health/") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ready: true }) });
    }
    if (path === "/api/v1/identity/me/") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(envelope(fakeAccount)) });
    if (path === "/api/v1/identity/oauth/providers/") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(envelope({ google: true, facebook: false, apple: false })) });
    if (path === "/api/v1/csrf/" && simulateOffline) return route.abort("failed");
    if (path === "/api/v1/csrf/") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ csrfToken: "synthetic-ci-token" }) });
    if (path === "/api/v1/patient/emergency-card/qr/ci-perf-token/") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(envelope(fakeEmergencyCard())) });
    if (path === "/api/v1/patient/care/encounters/" && method === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(envelope(draft ? [draft] : [])) });
    }
    if (path === "/api/v1/patient/care/encounters/" && method === "POST") {
      createRequests += 1;
      const body = JSON.parse(request.postData() || "{}") as Partial<Encounter>;
      draft = { ...fakeEncounter(), ...body, id: fakeEncounter().id, status: "draft", closed_at: null } as Encounter;
      if (options.simulateLostCreateResponse && !lostCreateResponse) {
        // Simule un POST validé côté serveur dont la réponse est perdue sur le réseau.
        lostCreateResponse = true;
        return route.abort("failed");
      }
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(envelope(draft)) });
    }
    if (path.startsWith("/api/v1/patient/care/encounters/") && method === "PATCH") {
      updateRequests += 1;
      const body = JSON.parse(request.postData() || "{}") as Partial<Encounter>;
      draft = { ...(draft ?? fakeEncounter()), ...body } as Encounter;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(envelope(draft)) });
    }
    if (path === "/api/v1/patient/care/patient/preconsultation-templates/") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(envelope([])) });
    if (path === "/api/v1/patient/care/access-grants/" || path === "/api/v1/patient/care/access-audit/") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(envelope([])) });
    if (path === "/api/v1/patient/care/access-qr/" && method === "POST") {
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(envelope({ token: "SYNTHETIC-QR-TOKEN", expires_in_seconds: 300 })) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(envelope([])) });
  });

  return { counts: () => ({ createRequests, updateRequests }), setOffline: (value: boolean) => { simulateOffline = value; } };
}

async function createConstrainedMobilePage(browser: Browser) {
  const context = await browser.newContext({ ...devices["Pixel 5"], baseURL: "http://127.0.0.1:3100", serviceWorkers: "block" });
  const page = await context.newPage();
  await page.addInitScript(() => {
    (window as Window & { __ecarnetLcp?: number }).__ecarnetLcp = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) (window as Window & { __ecarnetLcp?: number }).__ecarnetLcp = entry.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: 200_000,
    uploadThroughput: 93_750,
    connectionType: "cellular4g",
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  return { context, page };
}

async function declineAnalyticsConsent(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Un petit cookie, à votre convenance." });
  if (await dialog.isVisible()) {
    await dialog.getByRole("button", { name: "Refuser", exact: true }).click();
    await expect(dialog).toBeHidden();
  }
}

async function assertBudget(page: Page, visibleMs: number, budget: { transferBytes: number; images: number; visibleMs: number }, label: string) {
  const metrics = await page.evaluate(() => {
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const imageSources = new Set(Array.from(document.images, (image) => image.currentSrc || image.src).filter(Boolean));
    return {
      transferBytes: resources.reduce((total, resource) => total + (resource.transferSize || 0), 0),
      imageCount: imageSources.size,
      lcpMs: Math.round((window as Window & { __ecarnetLcp?: number }).__ecarnetLcp || 0),
      resourceCount: resources.length,
    };
  });
  expect(metrics.transferBytes, `${label}: poids reçu (${metrics.transferBytes} octets, ${metrics.resourceCount} ressources)`).toBeLessThanOrEqual(budget.transferBytes);
  expect(metrics.imageCount, `${label}: nombre d’images`).toBeLessThanOrEqual(budget.images);
  expect(visibleMs, `${label}: délai jusqu’au contenu utile visible`).toBeLessThanOrEqual(budget.visibleMs);
  expect(metrics.lcpMs, `${label}: LCP observé`).toBeLessThanOrEqual(budget.visibleMs);
}

function skipUnlessMobileChromium(isMobile: boolean, browserName: string) {
  test.skip(!isMobile || browserName !== "chromium", "Budget de référence mobile : Pixel 5/Chromium simulé.");
}

test("PAT-21 : budgets mobiles sur l’accueil et la connexion", async ({ browser, isMobile, browserName }) => {
  skipUnlessMobileChromium(isMobile, browserName);
  const { context, page } = await createConstrainedMobilePage(browser);
  await installSyntheticApi(page);
  try {
    let startedAt = Date.now();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    let visibleMs = Date.now() - startedAt;
    await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));
    await assertBudget(page, visibleMs, { transferBytes: 820_000, images: 4, visibleMs: 4_500 }, "Accueil");
    await declineAnalyticsConsent(page);

    startedAt = Date.now();
    await page.goto("/connexion", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Votre santé, votre carnet, votre décision." })).toBeVisible();
    visibleMs = Date.now() - startedAt;
    await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));
    await assertBudget(page, visibleMs, { transferBytes: 460_000, images: 4, visibleMs: 5_000 }, "Connexion");
    await expect(page.getByRole("link", { name: "Continuer avec Google" }).first()).toBeVisible();
  } finally {
    await context.close();
  }
});

test("PAT-21 : budget de la carte d’urgence publique avec données fictives", async ({ browser, isMobile, browserName }) => {
  skipUnlessMobileChromium(isMobile, browserName);
  const { context, page } = await createConstrainedMobilePage(browser);
  await installSyntheticApi(page);
  try {
    const startedAt = Date.now();
    await page.goto("/urgence/ci-perf-token", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("article", { name: "Carte d’urgence" })).toBeVisible();
    const visibleMs = Date.now() - startedAt;
    await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));
    await assertBudget(page, visibleMs, { transferBytes: 360_000, images: 4, visibleMs: 5_000 }, "Carte d’urgence");
  } finally {
    await context.close();
  }
});

test("PAT-21 : budget de la pré-consultation et du QR temporaire", async ({ browser, isMobile, browserName }) => {
  skipUnlessMobileChromium(isMobile, browserName);
  const { context, page } = await createConstrainedMobilePage(browser);
  const api = await installSyntheticApi(page, { draft: null, simulateLostCreateResponse: true });
  try {
    const startedAt = Date.now();
    await page.goto("/patient/consultations", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Préparer ma consultation" })).toBeVisible();
    const visibleMs = Date.now() - startedAt;
    await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));
    await assertBudget(page, visibleMs, { transferBytes: 450_000, images: 4, visibleMs: 6_500 }, "Pré-consultation");
    await declineAnalyticsConsent(page);

    // Hors connexion, l'amorçage CSRF échoue : aucune écriture n'est envoyée ni mise en file.
    await page.getByLabel("Motif", { exact: true }).fill("Contrôle de démonstration");
    api.setOffline(true);
    await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
    await expect(page.getByRole("button", { name: "Réessayer l’enregistrement" })).toBeVisible();
    await expect(page.getByText("Rien n’est envoyé hors connexion.", { exact: false })).toBeVisible();
    expect(api.counts()).toEqual({ createRequests: 0, updateRequests: 0 });

    // En ligne, le POST est validé côté serveur mais sa réponse est perdue.
    api.setOffline(false);
    await page.getByRole("button", { name: "Réessayer l’enregistrement" }).click();
    await expect(page.getByRole("button", { name: "Réessayer l’enregistrement" })).toBeVisible();
    expect(api.counts()).toEqual({ createRequests: 1, updateRequests: 0 });
    // La reprise relit le brouillon et le met à jour au lieu de créer un doublon.
    await page.getByRole("button", { name: "Réessayer l’enregistrement" }).click();
    await expect(page.getByText("Enregistré. Pour le médecin, ouvrez votre QR temporaire.")).toBeVisible();
    expect(api.counts()).toEqual({ createRequests: 1, updateRequests: 1 });

  } finally {
    await context.close();
  }
});

test("PAT-21 : budget du QR temporaire sur une session froide", async ({ browser, isMobile, browserName }) => {
  skipUnlessMobileChromium(isMobile, browserName);
  const { context, page } = await createConstrainedMobilePage(browser);
  await installSyntheticApi(page, { draft: fakeEncounter() });
  try {
    const startedAt = Date.now();
    await page.goto("/patient/consultations", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Générer un QR temporaire" })).toBeVisible();
    const initialVisibleMs = Date.now() - startedAt;
    await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));
    await assertBudget(page, initialVisibleMs, { transferBytes: 470_000, images: 4, visibleMs: 6_500 }, "Écran du QR temporaire");
    await declineAnalyticsConsent(page);

    const qrStartedAt = Date.now();
    await page.getByRole("button", { name: "Générer un QR temporaire" }).click();
    await expect(page.getByRole("group", { name: "QR temporaire actif" })).toBeVisible();
    await assertBudget(page, Date.now() - qrStartedAt, { transferBytes: 470_000, images: 4, visibleMs: 3_000 }, "Génération du QR temporaire");
  } finally {
    await context.close();
  }
});
