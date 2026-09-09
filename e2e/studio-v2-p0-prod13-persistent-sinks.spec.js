import { expect, test } from "@playwright/test";
import { admitPublicGateway, openEditor } from "./studio-v2-helpers.js";
import { readClientStorage } from "./studio-v2-storage-inspection.js";

const CANARY = "REAL-SINK-CANARY-20260908";

test("PROD-13 13-02 keeps Real preview, apply and review payloads volatile", async ({ page }) => {
  await page.goto("/studio-v2/");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  await openEditor(page);
  await page.locator("label.privacy-toggle").click();
  await expect(page.locator("#data-policy")).toHaveText(/Real data|真实数据/i);
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  await admitPublicGateway(page);

  const manifestEditor = page.locator("#manifest-editor");
  const manifest = JSON.parse(await manifestEditor.inputValue());
  manifest.title = CANARY;
  await manifestEditor.fill(JSON.stringify(manifest, null, 2));
  await page.locator("#apply-source-button").click();
  await page.locator("#source-diff-apply").click();
  await expect(page.locator("#manifest-editor")).toHaveValue(new RegExp(CANARY));
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });

  const before = await readClientStorage(page);
  const result = await page.evaluate(async () => {
    const run = (name, input = {}) => window.PrintFormStudioAgent.execute(name, input);
    const initial = await run("get_revision");
    const preview = await run("preview_changes", {
      expectedRevision: initial.result.revision,
      operations: [{ type: "set_brand_color", hex: "#854d0e" }]
    });
    if (!preview.ok) return { initial, preview };
    const approve = await run("approve_transaction", {
      expectedRevision: preview.result.revision,
      transactionId: preview.result.transactionId,
      expectedCandidateHash: preview.result.candidateHash,
      requireValid: false
    });
    if (!approve.ok) return { initial, preview, approve };
    const apply = await run("apply_changes", {
      expectedRevision: preview.result.revision,
      transactionId: preview.result.transactionId,
      expectedCandidateHash: preview.result.candidateHash,
      requireValid: false
    });
    if (!apply.ok) return { initial, preview, approve, apply };
    const history = await run("get_transaction_history");
    const beginReview = await run("begin_layout_review", { expectedRevision: apply.result.revision });
    const defaultEvidence = await run("capture_layout_evidence", {
      expectedRevision: apply.result.revision, scenario: "default", visualMode: "geometry"
    });
    const longTextEvidence = await run("capture_layout_evidence", {
      expectedRevision: apply.result.revision, scenario: "long-text", visualMode: "geometry"
    });
    const review = await run("complete_layout_review", {
      expectedRevision: apply.result.revision,
      reviewer: "ai-agent",
      evidenceIds: [defaultEvidence.result.evidence.evidenceId, longTextEvidence.result.evidence.evidenceId],
      findings: [],
      summary: "Controlled geometry-only review"
    });
    return { initial, preview, approve, apply, history, beginReview, defaultEvidence, longTextEvidence, review };
  });
  const after = await readClientStorage(page);
  expect(result.initial.ok).toBe(true);
  expect(result.preview.ok).toBe(true);
  expect(result.approve.ok).toBe(true);
  expect(result.apply.ok).toBe(true);
  expect(result.apply.result.revision).toBe(result.initial.result.revision + 1);
  expect(result.review.ok).toBe(true);
  expect(result.review.result.review.status).toBe("pass");
  expect(result.defaultEvidence.result.evidence.visualMode).toBe("geometry");
  expect(result.longTextEvidence.result.evidence.visualMode).toBe("geometry");

  const beforeDocumentKeys = Object.keys(before.local).filter((key) => key.startsWith("printform:"));
  const afterDocumentKeys = Object.keys(after.local).filter((key) => key.startsWith("printform:"));
  expect(afterDocumentKeys).toEqual(beforeDocumentKeys);
  expect(JSON.stringify(result)).not.toContain(CANARY);
  expect(JSON.stringify(after)).not.toContain(CANARY);
  expect(after.cacheEntries.some((entry) => entry.url.includes("real-sink-canary.html"))).toBe(false);
});
