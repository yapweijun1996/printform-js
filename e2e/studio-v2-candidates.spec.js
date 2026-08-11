import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/studio-v2/");
  await expect(page).toHaveTitle(/PrintForm Studio v2/);
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
});

test("renders a preview_changes candidate for real before apply_changes reuses the same report", async ({ page }) => {
  const baseline = JSON.parse(await page.locator("#metrics-output").textContent());
  expect(baseline.rows).toBe(45);
  await expect(page.locator("#candidate-preview-banner")).toBeHidden();

  const result = await page.evaluate(async () => {
    const summary = await window.PrintFormStudioAgent.execute("get_project_summary");
    const operations = [{ type: "set_font_scale", basePt: 14 }];
    const preview = await window.PrintFormStudioAgent.execute("preview_changes", { expectedRevision: summary.result.revision, operations });
    const applied = await window.PrintFormStudioAgent.execute("apply_changes", { expectedRevision: summary.result.revision, operations, reason: "e2e candidate cache reuse" });
    return { revision: summary.result.revision, preview, applied };
  });

  expect(result.preview.ok).toBe(true);
  expect(result.preview.result.candidateHash).toEqual(expect.any(String));
  expect(result.preview.result.validation.metrics.rows).toBe(45);
  expect(result.preview.result.validation.metrics.logicalPages).toBeGreaterThan(baseline.logicalPages);
  expect(result.preview.result.validation.metrics.expectedRows).toBe(45);
  expect(result.preview.result.validation.metrics.renderedRows).toBe(45);
  expect(result.revision).toBe(0);
  expect(result.applied.ok).toBe(true);
  expect(result.applied.result.candidateHash).toBe(result.preview.result.candidateHash);
  expect(result.applied.result.validation.metrics.logicalPages).toBe(result.preview.result.validation.metrics.logicalPages);
  await expect(page.locator("#revision-label")).toHaveText("Revision 1");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  await expect(page.locator("#candidate-preview-banner")).toBeHidden();
});

test("lets the end user undo and redo an automatically validated design revision", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const operations = [{ type: "set_brand_color", hex: "#b42318" }];
    const preview = await window.PrintFormStudioAgent.execute("preview_changes", { expectedRevision: 0, operations });
    const applied = await window.PrintFormStudioAgent.execute("apply_changes", {
      expectedRevision: 0, operations, expectedCandidateHash: preview.result.candidateHash, requireValid: true,
      reason: "e2e red purchase-order style"
    });
    return { preview, applied };
  });

  expect(result.preview.ok).toBe(true);
  expect(result.applied.ok).toBe(true);
  await expect(page.locator("#revision-label")).toHaveText("Revision 1");
  await page.locator("#ai-designer-tab").click();
  await expect(page.locator("#ai-undo-revision")).toBeEnabled();
  await expect(page.locator("#ai-redo-revision")).toBeDisabled();

  await page.locator("#ai-undo-revision").click();
  await expect(page.locator("#revision-label")).toHaveText("Revision 0");
  await expect(page.locator("#ai-undo-revision")).toBeDisabled();
  await expect(page.locator("#ai-redo-revision")).toBeEnabled();

  await page.locator("#ai-redo-revision").click();
  await expect(page.locator("#revision-label")).toHaveText("Revision 1");
  await expect(page.locator("#ai-undo-revision")).toBeEnabled();
  await expect(page.locator("#ai-redo-revision")).toBeDisabled();
});

test("issues layout evidence receipts and rejects self-declared evidence", async ({ page }) => {
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
  const defaultEvidence = result.captured.default.result.evidence;
  const longTextEvidence = result.captured["long-text"].result.evidence;
  expect(defaultEvidence.layoutFingerprint).toEqual(expect.any(String));
  expect(defaultEvidence.baseProjectHash).toEqual(expect.any(String));
  expect(defaultEvidence.candidateHash).toBe(defaultEvidence.baseProjectHash);
  expect(defaultEvidence.snapshot).toMatchObject({ source: "geometry-only", redacted: true, mimeType: "image/svg+xml" });
  expect(defaultEvidence.browser.name).toEqual(expect.any(String));
  expect(longTextEvidence.layoutFingerprint).not.toBe(defaultEvidence.layoutFingerprint);
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
