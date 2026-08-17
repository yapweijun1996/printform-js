import { expect, test } from "@playwright/test";
import { openEditor } from "./studio-v2-helpers.js";

test.beforeEach(async ({ page }) => {
  await page.goto("/studio-v2/");
  await expect(page).toHaveTitle(/PrintForm Studio v2/);
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
});

test("keeps mobile Studio controls inside the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.viewport);
  await expect(page.locator("#preview-frame")).toBeVisible();
});

test("meets the 100-row and 500-row render budgets", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Absolute performance budget uses the Chromium reference environment");
  await openEditor(page);
  await page.locator("#scenario-select").selectOption("100-rows");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 10_000 });
  await expect.poll(async () => JSON.parse(await page.locator("#metrics-output").textContent()).rows, { timeout: 20_000 }).toBe(100);
  let metrics = JSON.parse(await page.locator("#metrics-output").textContent());
  expect(metrics.rows).toBe(100);
  expect(metrics.durationMs).toBeLessThanOrEqual(2000);
  await page.locator("#scenario-select").selectOption("500-rows");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 15_000 });
  await expect.poll(async () => JSON.parse(await page.locator("#metrics-output").textContent()).rows, { timeout: 20_000 }).toBe(500);
  metrics = JSON.parse(await page.locator("#metrics-output").textContent());
  expect(metrics.rows).toBe(500);
  expect(metrics.logicalPages).toBeLessThanOrEqual(100);
  expect(metrics.durationMs).toBeLessThanOrEqual(5000);
});

test("meets the render budget for 500 rows at an enlarged font scale", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Absolute performance budget uses the Chromium reference environment");
  await openEditor(page);
  // This exact combination previously took 47+ seconds in a real browser.
  await page.locator("#scenario-select").selectOption("500-rows");
  await page.evaluate(async () => {
    const summary = await window.PrintFormStudioAgent.execute("get_project_summary", {});
    await window.PrintFormStudioAgent.execute("apply_changes", {
      expectedRevision: summary.result.revision,
      operations: [{ type: "set_font_scale", basePt: 13 }]
    });
  });
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 15_000 });
  await expect.poll(async () => JSON.parse(await page.locator("#metrics-output").textContent()).rows, { timeout: 20_000 }).toBe(500);
  const metrics = JSON.parse(await page.locator("#metrics-output").textContent());
  expect(metrics.rows).toBe(500);
  expect(metrics.durationMs).toBeLessThanOrEqual(5000);
});

test("serves the installed PWA shell while offline", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "Service worker offline contract is browser-independent and covered once");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveTitle(/PrintForm Studio v2/);
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  await page.locator("#ui-locale-select").selectOption("ja-JP");
  await expect(page.locator(".editor-panel h2")).toHaveText("プロジェクトソース");
  await context.setOffline(false);
});
