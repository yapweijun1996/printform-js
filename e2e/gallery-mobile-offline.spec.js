import { test, expect } from "@playwright/test";

test("pinned embedded preview adapter works offline", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto("/gallery/index.html");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 30000 }).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page.locator('[data-design-id="bilingual-academy-invoice"]').click();
  await expect(page.locator("[data-print]")).toBeEnabled();
  await expect(page.locator("[data-settings]")).toBeVisible();
});
