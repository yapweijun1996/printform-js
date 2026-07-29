import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/studio-v2/");
  await expect(page).toHaveTitle(/PrintForm Studio v2/);
  await expect(page.locator("#render-status")).toHaveText("可打印", { timeout: 20_000 });
});

async function passLayoutReview(page) {
  return page.evaluate(async () => {
    const summary = await window.PrintFormStudioAgent.execute("get_project_summary");
    await window.PrintFormStudioAgent.execute("begin_layout_review", { expectedRevision: summary.result.revision });
    return window.PrintFormStudioAgent.execute("complete_layout_review", {
      expectedRevision: summary.result.revision, reviewer: "ai-agent", browser: navigator.userAgent,
      scenarios: ["default", "long-text"], evidence: ["full-page-screenshot", "layout-metrics"],
      findings: [], summary: "Automated browser invariants and full-page fixture reviewed"
    });
  });
}

test("renders the 45-row sales invoice through the isolated runtime", async ({ page }) => {
  const metrics = JSON.parse(await page.locator("#metrics-output").textContent());
  expect(metrics.rows).toBe(45);
  expect(metrics.logicalPages).toBeGreaterThan(0);
  expect(metrics.logicalPages).toBeLessThanOrEqual(100);
  expect(metrics.overflowElements).toBe(0);
  expect(metrics.verticalOverflowPages).toBe(0);
  expect(metrics.contrastFailures).toBe(0);
  expect((await passLayoutReview(page)).ok).toBe(true);
  await expect(page.locator("#quality-summary")).toContainText("生产质量门通过");
});

test("renders all five locales and visible replaceable logo slots", async ({ page }) => {
  const expected = { "en-MY": "Sales Invoice", "zh-CN": "销售发票", "ms-MY": "Invois Jualan", "ja-JP": "売上請求書", "vi-VN": "Hóa đơn bán hàng" };
  for (const [locale, title] of Object.entries(expected)) {
    await page.locator("#locale-select").selectOption(locale);
    await expect(page.locator("#render-status")).toHaveText("可打印", { timeout: 20_000 });
    await expect(page.frameLocator("#preview-frame").locator(".pf-title").first()).toHaveText(title);
  }
  const logos = page.frameLocator("#preview-frame").locator("[data-pf-asset-slot]");
  expect(await logos.evaluateAll((nodes) => [...new Set(nodes.map((node) => node.dataset.pfAssetSlot))].sort())).toEqual(["footer-logo", "letterhead-logo"]);
  expect(await logos.evaluateAll((nodes) => nodes.every((node) => node.naturalWidth > 0 && node.alt))).toBe(true);
});

test("renders the Crimson purchase order in five languages and boundary layouts", async ({ page }) => {
  await page.goto("/studio-v2/?sample=purchase-order-red");
  await expect(page.locator("#render-status")).toHaveText("可打印", { timeout: 20_000 });
  await expect(page.locator("#document-select")).toHaveValue("purchase-order-red");
  let metrics = JSON.parse(await page.locator("#metrics-output").textContent());
  expect(metrics).toMatchObject({ rows: 32, overflowElements: 0, verticalOverflowPages: 0, contrastFailures: 0 });
  const expected = { "en-MY": "Purchase Order", "zh-CN": "采购订单", "ms-MY": "Pesanan Belian", "ja-JP": "発注書", "vi-VN": "Đơn đặt hàng" };
  for (const [locale, title] of Object.entries(expected)) {
    await page.locator("#locale-select").selectOption(locale);
    await expect(page.locator("#render-status")).toHaveText("可打印", { timeout: 20_000 });
    await expect(page.frameLocator("#preview-frame").locator(".pf-po-box h2").first()).toHaveText(title);
  }
  const logos = page.frameLocator("#preview-frame").locator("[data-pf-asset-slot]");
  expect(await logos.evaluateAll((nodes) => [...new Set(nodes.map((node) => node.dataset.pfAssetSlot))].sort())).toEqual(["footer-logo", "letterhead-logo"]);
  await page.locator("#scenario-select").selectOption("long-text");
  await expect(page.locator("#render-status")).toHaveText("可打印", { timeout: 20_000 });
  metrics = JSON.parse(await page.locator("#metrics-output").textContent());
  expect(metrics.logicalPages).toBeLessThanOrEqual(100);
  expect(metrics).toMatchObject({ overflowElements: 0, verticalOverflowPages: 0, contrastFailures: 0 });
});

test("opens the generated Crimson purchase order as one self-contained HTML", async ({ page }) => {
  await page.goto("/studio-v2/samples/purchase-order-red-v2.html");
  await expect(page.locator("html")).toHaveAttribute("data-printform-status", "ready", { timeout: 20_000 });
  await expect(page.locator(".printform_page")).toHaveCount(3);
  expect(await page.locator(".printform_page").nth(2).locator(".prowheader,.prowheader_processed").count()).toBe(0);
  await expect(page.locator(".printform_page").nth(2)).toContainText("Grand total");
  expect(await page.locator('script[src],link[rel="stylesheet"][href]').count()).toBe(0);
  const headerGaps = await page.locator(".printform_page").evaluateAll((pages) => pages.map((node) => {
    const line = node.querySelector(".pf-topline").getBoundingClientRect();
    const grid = node.querySelector(".pf-header-grid").getBoundingClientRect();
    return grid.top - line.bottom;
  }));
  expect(headerGaps.every((gap) => gap >= 8)).toBe(true);
});

test("covers Crimson purchase order empty, 1, 45 and 500-row boundaries", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Large boundary budgets use the Chromium reference environment");
  await page.goto("/studio-v2/?sample=purchase-order-red");
  await page.locator("#scenario-select").selectOption("empty");
  await expect(page.locator("#render-status")).toHaveText("已阻断", { timeout: 20_000 });
  await expect(page.locator("#issue-list")).toContainText("MIN_ITEMS");
  for (const [scenario, rows] of [["one", 1], ["45-rows", 45], ["500-rows", 500]]) {
    await page.locator("#scenario-select").selectOption(scenario);
    await expect(page.locator("#render-status")).toHaveText("可打印", { timeout: 20_000 });
    const metrics = JSON.parse(await page.locator("#metrics-output").textContent());
    expect(metrics.rows).toBe(rows);
    expect(metrics.logicalPages).toBeLessThanOrEqual(100);
    expect(metrics).toMatchObject({ overflowElements: 0, verticalOverflowPages: 0, contrastFailures: 0 });
    if (rows === 500) expect(metrics.durationMs).toBeLessThanOrEqual(5000);
  }
});

test("uses the public command gateway for transactional changes", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const summary = await window.PrintFormStudioAgent.execute("get_project_summary");
    const preview = await window.PrintFormStudioAgent.execute("preview_changes", {
      expectedRevision: summary.result.revision,
      operations: [{ type: "set_manifest_value", path: "/title", value: "Agent revised invoice" }]
    });
    const applied = await window.PrintFormStudioAgent.execute("apply_changes", {
      expectedRevision: summary.result.revision,
      operations: [{ type: "set_manifest_value", path: "/title", value: "Agent revised invoice" }]
    });
    return { summary, preview, applied };
  });
  expect(result.preview.result.diff.changed).toBe(true);
  expect(result.applied.result.revision).toBe(1);
  await expect(page.locator("#manifest-editor")).toHaveValue(/Agent revised invoice/);
  await expect(page.locator("#render-status")).toHaveText("可打印", { timeout: 20_000 });
});

test("requires a human confirmation and downloads one trusted HTML", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "Download contract is covered once; render invariants run in every engine");
  expect((await passLayoutReview(page)).ok).toBe(true);
  page.on("dialog", (dialog) => dialog.message().includes("另存为") ? dialog.dismiss() : dialog.accept());
  const downloadEvent = page.waitForEvent("download");
  await page.locator("#export-button").click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("sales-invoice-pilot.html");
  const stream = await download.createReadStream();
  let html = "";
  for await (const chunk of stream) html += chunk.toString();
  expect(html).toContain('id="pf-manifest"');
  expect(html).toContain('id="pf-document-runtime"');
  expect(html).toContain('Content-Security-Policy');
  expect(new TextEncoder().encode(html).byteLength).toBeLessThan(10 * 1024 * 1024);
  const standalone = await context.newPage();
  await standalone.goto(`data:text/html;base64,${Buffer.from(html).toString("base64")}`);
  await expect(standalone.locator("html")).toHaveAttribute("data-printform-status", "ready", { timeout: 20_000 });
  expect(await standalone.locator(".printform_page").count()).toBeGreaterThan(0);
});

test("keeps mobile Studio controls inside the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.viewport);
  await expect(page.locator("#preview-frame")).toBeVisible();
});

test("meets the 100-row and 500-row render budgets", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Absolute performance budget uses the Chromium reference environment");
  await page.locator("#scenario-select").selectOption("100-rows");
  await expect(page.locator("#render-status")).toHaveText("可打印", { timeout: 10_000 });
  let metrics = JSON.parse(await page.locator("#metrics-output").textContent());
  expect(metrics.rows).toBe(100);
  expect(metrics.durationMs).toBeLessThanOrEqual(2000);
  await page.locator("#scenario-select").selectOption("500-rows");
  await expect(page.locator("#render-status")).toHaveText("可打印", { timeout: 15_000 });
  metrics = JSON.parse(await page.locator("#metrics-output").textContent());
  expect(metrics.rows).toBe(500);
  expect(metrics.logicalPages).toBeLessThanOrEqual(100);
  expect(metrics.durationMs).toBeLessThanOrEqual(5000);
});

test("serves the installed PWA shell while offline", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "Service worker offline contract is browser-independent and covered once");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.locator("#render-status")).toHaveText("可打印", { timeout: 20_000 });
  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveTitle(/PrintForm Studio v2/);
  await expect(page.locator("#render-status")).toHaveText("可打印", { timeout: 20_000 });
  await context.setOffline(false);
});
