import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/studio-v2/");
  await expect(page).toHaveTitle(/PrintForm Studio v2/);
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
});

test("publishes link-only setup for Codex and Claude Code", async ({ page }) => {
  const manifest = await page.evaluate(async () => {
    const response = await fetch("./agent-setup.json");
    if (!response.ok) throw new Error(`Agent manifest HTTP ${response.status}`);
    return response.json();
  });
  expect(manifest.schemaVersion).toBe("1.0.0");
  expect(manifest.clients).toHaveProperty("codex");
  expect(manifest.clients).toHaveProperty("claudeCode");
  expect(manifest.verification.expectedWebMcpToolCount).toBe(16);
  await expect(page.locator(".agent-bootstrap")).toBeVisible();
  await expect(page.locator('.agent-bootstrap a[href="./agent-setup.json"]')).toHaveText("Machine manifest");
  await expect(page.locator('link[rel="help"]')).toHaveAttribute("href", "./agent-setup.json");
});

async function passLayoutReview(page) {
  return page.evaluate(async () => {
    const summary = await window.PrintFormStudioAgent.execute("get_project_summary");
    const expectedRevision = summary.result.revision;
    // Agent Contract 2.0: the review is backed by Studio-issued receipts, so
    // each required scenario must actually be rendered and signed first.
    const evidenceIds = [];
    for (const scenario of ["default", "long-text"]) {
      const captured = await window.PrintFormStudioAgent.execute("capture_layout_evidence", { expectedRevision, scenario });
      if (!captured.ok) throw new Error(`capture_layout_evidence(${scenario}) failed: ${captured.error.code}`);
      if (!captured.result.evidence) throw new Error(`Scenario ${scenario} did not render cleanly: ${JSON.stringify(captured.result.validation.errors)}`);
      evidenceIds.push(captured.result.evidence.evidenceId);
    }
    await window.PrintFormStudioAgent.execute("begin_layout_review", { expectedRevision });
    return window.PrintFormStudioAgent.execute("complete_layout_review", {
      expectedRevision, reviewer: "ai-agent", evidenceIds,
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
  await expect(page.locator("#quality-summary")).toContainText("Production quality gate passed");
});

test("tags every rendered row with a stable, correctly ordered source-array index inside the sandboxed preview", async ({ page }) => {
  // Regression proof that binding.js's data-pf-row-index tagging survives
  // the real dist/printform.js pagination engine (clone/measure/place across
  // pages) inside the actual sandboxed iframe — a jsdom-only unit test can't
  // prove this because it either mocks formatAll() or fights Node's global
  // shimming; this is the one place that exercises the real bundle end to end.
  const rowFrame = page.frameLocator("#preview-frame");
  const indices = await rowFrame.locator(".prowitem_processed").evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute("data-pf-row-index"))));
  expect(indices).toHaveLength(45);
  expect(indices).toEqual(Array.from({ length: 45 }, (_, i) => i)); // strictly 0..44, in document order, across every page
  const validation = await page.evaluate(async () => (await window.PrintFormStudioAgent.execute("validate_project")).result.validation);
  expect(validation.errors.some((item) => String(item.code).startsWith("ROW_"))).toBe(false);
  expect(validation.metrics).toMatchObject({ renderedRows: 45, expectedRows: 45 });
});

test("renders all five locales and visible replaceable logo slots", async ({ page }) => {
  const expected = { "en-MY": "Sales Invoice", "zh-CN": "销售发票", "ms-MY": "Invois Jualan", "ja-JP": "売上請求書", "vi-VN": "Hóa đơn bán hàng" };
  for (const [locale, title] of Object.entries(expected)) {
    await page.locator("#locale-select").selectOption(locale);
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await expect(page.frameLocator("#preview-frame").locator(".pf-title").first()).toHaveText(title);
  }
  const logos = page.frameLocator("#preview-frame").locator("[data-pf-asset-slot]");
  expect(await logos.evaluateAll((nodes) => [...new Set(nodes.map((node) => node.dataset.pfAssetSlot))].sort())).toEqual(["footer-logo", "letterhead-logo"]);
  expect(await logos.evaluateAll((nodes) => nodes.every((node) => node.naturalWidth > 0 && node.alt))).toBe(true);
});

test("switches the Studio UI across five languages without changing the document", async ({ page }) => {
  const revision = await page.evaluate(async () => (await window.PrintFormStudioAgent.execute("get_project_summary")).result.revision);
  const expected = {
    "en-MY": "Project source", "zh-CN": "项目源", "ms-MY": "Sumber projek",
    "ja-JP": "プロジェクトソース", "vi-VN": "Nguồn dự án"
  };
  for (const [locale, heading] of Object.entries(expected)) {
    await page.evaluate((nextLocale) => {
      document.querySelector("#manifest-editor").focus();
      const select = document.querySelector("#ui-locale-select");
      select.value = nextLocale;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }, locale);
    await expect(page.locator(".editor-panel h2")).toHaveText(heading);
    expect(await page.evaluate(() => document.activeElement.id)).toBe("manifest-editor");
    await expect(page.locator("#locale-select")).toHaveValue("en-MY");
    await expect(page.frameLocator("#preview-frame").locator(".pf-title").first()).toHaveText("Sales Invoice");
  }
  const revisionAfter = await page.evaluate(async () => (await window.PrintFormStudioAgent.execute("get_project_summary")).result.revision);
  expect(revisionAfter).toBe(revision);
  await page.reload();
  await expect(page.locator(".editor-panel h2")).toHaveText("Nguồn dự án");
  await expect(page.locator("html")).toHaveAttribute("lang", "vi-VN");
  await expect(page.frameLocator("#preview-frame").locator(".pf-title").first()).toHaveText("Sales Invoice");
});

test("renders the Crimson purchase order in five languages and boundary layouts", async ({ page }) => {
  await page.goto("/studio-v2/?sample=purchase-order-red");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  await expect(page.locator("#document-select")).toHaveValue("purchase-order-red");
  let metrics = JSON.parse(await page.locator("#metrics-output").textContent());
  expect(metrics).toMatchObject({ rows: 32, overflowElements: 0, verticalOverflowPages: 0, contrastFailures: 0 });
  const expected = { "en-MY": "Purchase Order", "zh-CN": "采购订单", "ms-MY": "Pesanan Belian", "ja-JP": "発注書", "vi-VN": "Đơn đặt hàng" };
  for (const [locale, title] of Object.entries(expected)) {
    await page.locator("#locale-select").selectOption(locale);
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await expect(page.frameLocator("#preview-frame").locator(".pf-po-box h2").first()).toHaveText(title);
  }
  const logos = page.frameLocator("#preview-frame").locator("[data-pf-asset-slot]");
  expect(await logos.evaluateAll((nodes) => [...new Set(nodes.map((node) => node.dataset.pfAssetSlot))].sort())).toEqual(["footer-logo", "letterhead-logo"]);
  await page.locator("#scenario-select").selectOption("long-text");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  metrics = JSON.parse(await page.locator("#metrics-output").textContent());
  expect(metrics.logicalPages).toBeLessThanOrEqual(100);
  expect(metrics).toMatchObject({ overflowElements: 0, verticalOverflowPages: 0, contrastFailures: 0 });
});

test("opens the generated Crimson purchase order as one self-contained HTML", async ({ page }) => {
  await page.goto("/studio-v2/samples/purchase-order-red-v2.html");
  await expect(page.locator("html")).toHaveAttribute("data-printform-status", "ready", { timeout: 20_000 });
  const pages = page.locator(".printform_page");
  await expect(pages).toHaveCount(3);
  expect(await pages.locator(".pdocinfo_processed").count()).toBe(3);
  expect(await pages.nth(2).locator(".prowitem_processed").count()).toBeGreaterThan(0);
  expect(await pages.nth(2).locator(".prowheader_processed").count()).toBe(1);
  await expect(pages.nth(2)).toContainText("Grand total");
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
  await expect(page.locator("#render-status")).toHaveText("Blocked", { timeout: 20_000 });
  await expect(page.locator("#issue-list")).toContainText("MIN_ITEMS");
  for (const [scenario, rows] of [["one", 1], ["45-rows", 45], ["500-rows", 500]]) {
    await page.locator("#scenario-select").selectOption(scenario);
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    const metrics = JSON.parse(await page.locator("#metrics-output").textContent());
    expect(metrics.rows).toBe(rows);
    expect(metrics.logicalPages).toBeLessThanOrEqual(100);
    expect(metrics).toMatchObject({ overflowElements: 0, verticalOverflowPages: 0, contrastFailures: 0 });
    if (rows === 500) expect(metrics.durationMs).toBeLessThanOrEqual(5000);
  }
});

test("shows a side-by-side diff before applying a manual source edit, and cancel leaves the draft untouched", async ({ page }) => {
  const editor = page.locator("#manifest-editor");
  const original = await editor.inputValue();
  const edited = original.replace('"title": "Sales Invoice — PrintForm Studio v2"', '"title": "Edited via diff panel"');
  expect(edited).not.toBe(original);

  await editor.fill(edited);
  await page.locator("#apply-source-button").click();
  await expect(page.locator("#source-diff-modal")).toBeVisible();
  await expect(page.locator("#source-diff-body")).toContainText("Edited via diff panel");
  await expect(page.locator(".diff-line-added")).toContainText("Edited via diff panel");

  // Cancel must not touch the committed draft.
  await page.locator("#source-diff-cancel").click();
  await expect(page.locator("#source-diff-modal")).toBeHidden();
  const revisionAfterCancel = await page.evaluate(async () => (await window.PrintFormStudioAgent.execute("get_project_summary")).result.revision);
  expect(revisionAfterCancel).toBe(0);

  // Re-open and actually apply.
  await page.locator("#apply-source-button").click();
  await page.locator("#source-diff-apply").click();
  await expect(page.locator("#source-diff-modal")).toBeHidden();
  const summaryAfterApply = await page.evaluate(async () => (await window.PrintFormStudioAgent.execute("get_project_summary")).result);
  expect(summaryAfterApply.revision).toBe(1);
  expect(summaryAfterApply.title).toBe("Edited via diff panel");

  // Re-applying with no further edits shows a "nothing to apply" toast instead of the modal.
  await page.locator("#apply-source-button").click();
  await expect(page.locator("#toast")).toContainText("No changes to apply");
  await expect(page.locator("#source-diff-modal")).toBeHidden();
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
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
});

test("renders a preview_changes candidate for real in the shared preview iframe before apply_changes reuses the same report", async ({ page }) => {
  // P0-A #12: preview_changes must reflect REAL pagination for a
  // not-yet-committed candidate, not just static schema validation — and
  // apply_changes right after must reuse that same render rather than
  // paying for a second one. Kept to the default 45-row sample: a real
  // large-boundary candidate (500 rows) render pays for a full iframe
  // reload + runtime fetch + serialization on top of PrintForm's own
  // pagination, and was empirically observed to take upwards of tens of
  // seconds in this environment at a bumped font scale — far past what's
  // worth spending on an e2e assertion here (the 100/500-row perf budget
  // test below already covers that scale on the committed-state path).
  const baseline = JSON.parse(await page.locator("#metrics-output").textContent());
  expect(baseline.rows).toBe(45);
  await expect(page.locator("#candidate-preview-banner")).toBeHidden();

  const result = await page.evaluate(async () => {
    const summary = await window.PrintFormStudioAgent.execute("get_project_summary");
    const ops = [{ type: "set_font_scale", basePt: 14 }];
    const preview = await window.PrintFormStudioAgent.execute("preview_changes", { expectedRevision: summary.result.revision, operations: ops });
    const applied = await window.PrintFormStudioAgent.execute("apply_changes", { expectedRevision: summary.result.revision, operations: ops, reason: "e2e candidate cache reuse" });
    return { revision: summary.result.revision, preview, applied };
  });

  expect(result.preview.ok).toBe(true);
  expect(result.preview.result.candidateHash).toEqual(expect.any(String));
  expect(result.preview.result.validation.metrics.rows).toBe(45);
  // Real pagination, not a static guess: a real font bump on 45 real rows
  // must move the real page count, and expectedRows/renderedRows only ever
  // appear when acceptance.js actually walked a real rendered DOM.
  expect(result.preview.result.validation.metrics.logicalPages).toBeGreaterThan(baseline.logicalPages);
  expect(result.preview.result.validation.metrics.expectedRows).toBe(45);
  expect(result.preview.result.validation.metrics.renderedRows).toBe(45);
  // Still unapplied at the moment preview_changes returned.
  expect(result.revision).toBe(0);

  expect(result.applied.ok).toBe(true);
  // Same operations against the same base revision hash identically, so
  // apply_changes must serve the cached report from preview_changes above
  // instead of rendering the candidate a second time.
  expect(result.applied.result.candidateHash).toBe(result.preview.result.candidateHash);
  expect(result.applied.result.validation.metrics.logicalPages).toBe(result.preview.result.validation.metrics.logicalPages);
  await expect(page.locator("#revision-label")).toHaveText("Revision 1");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  await expect(page.locator("#candidate-preview-banner")).toBeHidden();
});

test("issues layout evidence receipts from real scenario renders and refuses self-declared evidence", async ({ page }) => {
  // P0-B #18 end to end against the real preview iframe: receipts must come
  // from Studio actually rendering each scenario, and the Agent Contract 1.x
  // "I looked at a screenshot" labels must no longer buy a passing review.
  const result = await page.evaluate(async () => {
    const run = (name, input) => window.PrintFormStudioAgent.execute(name, input);
    const capabilities = await run("get_capabilities", {});
    const revision = (await run("get_project_summary", {})).result.revision;
    const captured = {};
    for (const scenario of ["default", "long-text"]) captured[scenario] = await run("capture_layout_evidence", { expectedRevision: revision, scenario });
    await run("begin_layout_review", { expectedRevision: revision });
    const evidenceIds = ["default", "long-text"].map((scenario) => captured[scenario].result.evidence.evidenceId);
    const base = { expectedRevision: revision, reviewer: "ai-agent", findings: [], summary: "e2e evidence flow" };
    const legacy = await run("complete_layout_review", { ...base, evidenceIds, browser: navigator.userAgent, scenarios: ["default", "long-text"], evidence: ["full-page-screenshot", "layout-metrics"] });
    const forged = await run("complete_layout_review", { ...base, evidenceIds: ["forged-id"] });
    const accepted = await run("complete_layout_review", { ...base, evidenceIds });
    const exportable = await run("request_export", {});
    return { capabilities: capabilities.result.capabilities, captured, legacy, forged, accepted, exportable };
  });

  expect(result.capabilities.layoutEvidenceReceipts).toBe(true);
  // Receipts carry Studio's own measurements, and differ per scenario because
  // the geometry they fingerprint genuinely differs.
  const defaultEvidence = result.captured["default"].result.evidence;
  const longTextEvidence = result.captured["long-text"].result.evidence;
  expect(defaultEvidence.layoutFingerprint).toEqual(expect.any(String));
  expect(defaultEvidence.browser.name).toEqual(expect.any(String));
  expect(longTextEvidence.layoutFingerprint).not.toBe(defaultEvidence.layoutFingerprint);
  // Capturing evidence renders candidates; it must never commit one.
  expect(result.captured["long-text"].result.revision).toBe(0);

  expect(result.legacy.ok).toBe(false);
  expect(result.legacy.error.code).toBe("EVIDENCE_RECEIPT_REQUIRED");
  expect(result.forged.ok).toBe(false);
  expect(result.forged.error.code).toBe("EVIDENCE_UNKNOWN");
  expect(result.accepted.ok).toBe(true);
  expect(result.accepted.result.review.scenarios.sort()).toEqual(["default", "long-text"]);
  expect(result.accepted.result.review.browsers).toHaveLength(1);
  expect(result.exportable.result.ready).toBe(true);

  await expect(page.locator("#revision-label")).toHaveText("Revision 0");
});

test("requires a human confirmation and downloads one trusted HTML", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "Download contract is covered once; render invariants run in every engine");
  expect((await passLayoutReview(page)).ok).toBe(true);
  page.on("dialog", (dialog) => /Save As|另存为/.test(dialog.message()) ? dialog.dismiss() : dialog.accept());
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
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 10_000 });
  let metrics = JSON.parse(await page.locator("#metrics-output").textContent());
  expect(metrics.rows).toBe(100);
  expect(metrics.durationMs).toBeLessThanOrEqual(2000);
  await page.locator("#scenario-select").selectOption("500-rows");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 15_000 });
  metrics = JSON.parse(await page.locator("#metrics-output").textContent());
  expect(metrics.rows).toBe(500);
  expect(metrics.logicalPages).toBeLessThanOrEqual(100);
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
