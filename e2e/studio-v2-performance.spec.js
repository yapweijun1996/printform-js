import { expect, test } from "@playwright/test";
import { admitPublicGateway, openEditor } from "./studio-v2-helpers.js";

test.beforeEach(async ({ page }) => {
  await page.goto("/studio-v2/");
  await expect(page).toHaveTitle(/PrintForm Studio v2/);
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  await admitPublicGateway(page);
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
  await applyLargeFont(page);
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 15_000 });
  await expect.poll(async () => JSON.parse(await page.locator("#metrics-output").textContent()).rows, { timeout: 20_000 }).toBe(500);
  const metrics = JSON.parse(await page.locator("#metrics-output").textContent());
  expect(metrics.rows).toBe(500);
  expect(metrics.durationMs).toBeLessThanOrEqual(5000);
});

test("serves the installed PWA shell while offline", async ({ page, context, browserName }) => {
  test.skip(browserName === "webkit", "Playwright WebKit throws an internal error on a service-worker navigation after setOffline(true); offline shell is covered by Chromium and Firefox");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller)),{timeout:20000}).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveTitle(/PrintForm Studio v2/);
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  await page.locator("#ui-locale-select").selectOption("ja-JP");
  await expect(page.locator(".editor-panel h2")).toHaveText("プロジェクトソース");
  await context.setOffline(false);
});

async function assertRowIntegrity(page,rows) {
  const indices=await page.frameLocator('#preview-frame').locator('.prowitem_processed').evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.pfRowIndex)));
  expect(indices).toEqual(Array.from({length:rows},(_,i)=>i));
  const metrics=JSON.parse(await page.locator('#metrics-output').textContent());
  expect(metrics).toMatchObject({rows,overflowElements:0,verticalOverflowPages:0,contrastFailures:0});
  expect(metrics.logicalPages).toBeLessThanOrEqual(100);
}
test('100 and 500 rows retain exact identity, order and paper bounds in every engine',async({page})=> {
  await openEditor(page);
  for(const rows of [100,500]) {
    await page.locator('#scenario-select').selectOption(`${rows}-rows`);
    await expect.poll(async()=>JSON.parse(await page.locator('#metrics-output').textContent()).rows,{timeout:20000}).toBe(rows);
    await expect(page.locator('#render-status')).toHaveText('Printable');await assertRowIntegrity(page,rows);
  }
});
test('500 rows at 13pt retain identity and bounds independently of timing certification',async({page})=> {
  await openEditor(page);await page.locator('#scenario-select').selectOption('500-rows');
  await expect.poll(async()=>JSON.parse(await page.locator('#metrics-output').textContent()).rows,{timeout:20000}).toBe(500);
  await applyLargeFont(page);
  await expect.poll(async()=>JSON.parse(await page.locator('#metrics-output').textContent()).rows,{timeout:20000}).toBe(500);
  await expect(page.locator('#render-status')).toHaveText('Printable');await assertRowIntegrity(page,500);
});

async function applyLargeFont(page) {
  const revision=await page.locator('#revision-label').textContent();
  await page.locator('#font-scale-input').fill('13');
  await page.locator('#apply-font-scale-button').click();
  await expect(page.locator('#revision-label')).not.toHaveText(revision);
  const font=await page.frameLocator('#preview-frame').locator('#pf-mount').evaluate(n=>getComputedStyle(n).fontSize);
  expect(parseFloat(font)).toBeCloseTo(13*96/72,1);
}
