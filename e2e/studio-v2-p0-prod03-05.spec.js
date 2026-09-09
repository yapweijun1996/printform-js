import { expect, test } from "@playwright/test";
import { admitPublicGateway, openEditor, openInspector, passLayoutReview } from "./studio-v2-helpers.js";

test.describe.configure({ timeout: 180_000 });

async function run(page, name, input = {}) {
  return page.evaluate(({ name: command, input: payload }) => window.PrintFormStudioAgent.execute(command, payload), { name, input });
}

async function expectBlocked(page, revision) {
  const result = await run(page, "request_export");
  expect(result.ok).toBe(true);
  expect(result.result.revision).toBe(revision);
  expect(result.result.ready).toBe(false);
  expect(result.result.validation.errors.map((item) => item.code)).toContain("LAYOUT_REVIEW_REQUIRED");
  await expect(page.locator("#ai-context-status")).toHaveText(/Blocked/i);
  await expect(page.locator("#export-readiness")).toHaveText(/Blocked/i);
  await expect(page.locator("#export-button")).toBeDisabled();
  return result;
}

test.describe("Studio v2 PROD-03 03-05 late or wrong result", () => {
  test("rejects an old revision review after a newer edit", async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    const knownFirefoxAgrunCspDiagnostic = (message) => test.info().project.name === "firefox"
      && /Content-Security-Policy:[\s\S]*blocked a JavaScript eval[\s\S]*agrun\.min\.js/i.test(message);
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });

    await page.goto("/studio-v2/?sample=sales-invoice");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await openInspector(page);
    await page.locator("#ai-designer-tab").click();
    await admitPublicGateway(page);

    const initialReview = await passLayoutReview(page);
    expect(initialReview.ok).toBe(true);
    expect(initialReview.result.review.reviewedRevision).toBe(0);
    await expect(page.locator("#export-readiness")).toHaveText(/Ready/i);

    const staleReview = await page.evaluate(async () => {
      const execute = (name, input) => window.PrintFormStudioAgent.execute(name, input);
      const expectedRevision = (await execute("get_project_summary", {})).result.revision;
      const begun = await execute("begin_layout_review", { expectedRevision });
      const evidenceIds = [];
      for (const scenario of ["default", "long-text"]) {
        const captured = await execute("capture_layout_evidence", { expectedRevision, scenario });
        if (!captured.ok) throw new Error(`capture_layout_evidence(${scenario}) failed: ${captured.error.code}`);
        evidenceIds.push(captured.result.evidence.evidenceId);
      }
      return { expectedRevision, begun, evidenceIds };
    });
    expect(staleReview.expectedRevision).toBe(0);
    expect(staleReview.begun.ok).toBe(true);
    expect(staleReview.evidenceIds).toHaveLength(2);

    await openEditor(page);
    await page.locator("#locale-select").selectOption("zh-CN");
    await expect(page.locator("#revision-label")).toHaveText("Revision 1");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await expectBlocked(page, 1);

    const lateReview = await run(page, "complete_layout_review", {
      expectedRevision: staleReview.expectedRevision,
      reviewer: "ai-agent",
      evidenceIds: staleReview.evidenceIds,
      findings: [],
      summary: "Late result for the superseded revision"
    });
    expect(lateReview.ok).toBe(false);
    expect(lateReview.error.code).toBe("REVISION_CONFLICT");

    const currentReview = await run(page, "get_layout_review_status");
    expect(currentReview.result.revision).toBe(1);
    expect(currentReview.result.review.status).toBe("required");
    await expectBlocked(page, 1);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors.filter((message) => !knownFirefoxAgrunCspDiagnostic(message))).toEqual([]);
    if (consoleErrors.some(knownFirefoxAgrunCspDiagnostic)) test.info().annotations.push({
      type: "known-browser-diagnostic",
      description: "Firefox reports the existing AGRUN CSP eval diagnostic; no functional page error was observed."
    });
  });
});
