import { test, expect } from "@playwright/test";

test("la page d’accueil est navigable et expose le titre principal", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/E.?Carnet|Mon E.?Carnet/i);
  await expect(page.locator("main")).toBeVisible();
});

test("les pages publiques restent lisibles sur téléphone", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Ce scénario vérifie le viewport mobile.");
  for (const route of ["/", "/aide", "/securite", "/faq"]) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow, `débordement horizontal sur ${route}`).toBe(false);
  }
});

test("une route privée affiche un état de garde sans erreur serveur", async ({ page }) => {
  const response = await page.goto("/patient");
  expect(response?.status()).toBeLessThan(500);
  await expect(page.locator("main")).toBeVisible();
});
