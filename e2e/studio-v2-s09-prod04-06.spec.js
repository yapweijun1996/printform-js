import { expect, test } from "@playwright/test";
import { admitPublicGateway, openInspector } from "./studio-v2-helpers.js";

test.describe.configure({ timeout: 180_000 });

async function previewBrandColor(page) {
  return page.frameLocator("#preview-frame").locator(".pf-brand").first().evaluate((node) => getComputedStyle(node).color);
}

test.describe("Studio v2 S09 PROD-04 04-06 durable history", () => {
  test("restores committed preview and rebuilds monotonic Undo/Redo history after reload", async ({ page }) => {
    const browserErrors = [];
    const browserDiagnostics = [];
    const knownFirefoxAgrunCspDiagnostic = (message) => test.info().project.name === "firefox"
      && /Content-Security-Policy:[\s\S]*blocked a JavaScript eval[\s\S]*agrun\.min\.js/i.test(message);
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") browserDiagnostics.push(message.text()); });

    await page.goto("/studio-v2/?sample=sales-invoice");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await admitPublicGateway(page);
    const baseline = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      const design = await window.PrintFormStudioAgent.execute("inspect_design_state");
      return { revision: revision.result.revision, projectHash: revision.result.projectHash, brandColor: design.result.branding.primaryColor };
    });
    const baselinePreviewColor = await previewBrandColor(page);
    expect(baseline.revision).toBe(0);

    const applied = await page.evaluate(async () => {
      const summary = await window.PrintFormStudioAgent.execute("get_project_summary");
      const preview = await window.PrintFormStudioAgent.execute("preview_changes", { expectedRevision: summary.result.revision, operations: [{ type: "set_brand_color", hex: "#854d0e" }] });
      const approved = await window.PrintFormStudioAgent.execute("approve_transaction", { expectedRevision: summary.result.revision, transactionId: preview.result.transactionId, expectedCandidateHash: preview.result.candidateHash, requireValid: false });
      const commit = await window.PrintFormStudioAgent.execute("apply_changes", { expectedRevision: summary.result.revision, transactionId: preview.result.transactionId, expectedCandidateHash: preview.result.candidateHash, reason: "S09 durable history" });
      return { preview, approved, commit };
    });
    expect(applied.preview.ok).toBe(true);
    expect(applied.approved.ok).toBe(true);
    expect(applied.commit.ok).toBe(true);
    await expect(page.locator("#revision-label")).toHaveText("Revision 1");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    const committed = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      const design = await window.PrintFormStudioAgent.execute("inspect_design_state");
      return { revision: revision.result.revision, projectHash: revision.result.projectHash, brandColor: design.result.branding.primaryColor };
    });
    expect(committed.revision).toBe(1);
    expect(committed.brandColor).toBe("#854d0e");
    expect(await previewBrandColor(page)).not.toBe(baselinePreviewColor);

    await openInspector(page);
    await page.locator("#ai-designer-tab").click();
    await page.locator("#ai-undo-revision").click();
    await expect(page.locator("#revision-label")).toHaveText("Revision 2");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    const undone = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      const design = await window.PrintFormStudioAgent.execute("inspect_design_state");
      return { revision: revision.result.revision, projectHash: revision.result.projectHash, brandColor: design.result.branding.primaryColor };
    });
    expect(undone.revision).toBe(2);
    expect(undone.brandColor).toBe(baseline.brandColor);
    expect(await previewBrandColor(page)).toBe(baselinePreviewColor);

    await page.locator("#ai-redo-revision").click();
    await expect(page.locator("#revision-label")).toHaveText("Revision 3");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    const redone = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      const design = await window.PrintFormStudioAgent.execute("inspect_design_state");
      return { revision: revision.result.revision, projectHash: revision.result.projectHash, brandColor: design.result.branding.primaryColor };
    });
    expect(redone.revision).toBe(3);
    expect(redone.projectHash).toEqual(expect.any(String));
    expect(redone.brandColor).toBe("#854d0e");
    expect(await previewBrandColor(page)).not.toBe(baselinePreviewColor);

    await page.reload();
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await openInspector(page);
    await page.locator("#ai-designer-tab").click();
    await admitPublicGateway(page);
    await expect(page.locator("#revision-label")).toHaveText("Revision 3");
    await expect(page.locator("#ai-undo-revision")).toBeEnabled();
    await expect(page.locator("#ai-redo-revision")).toBeDisabled();
    const reloaded = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      const design = await window.PrintFormStudioAgent.execute("inspect_design_state");
      return { revision: revision.result.revision, projectHash: revision.result.projectHash, brandColor: design.result.branding.primaryColor };
    });
    expect(reloaded).toEqual(redone);
    expect(await previewBrandColor(page)).not.toBe(baselinePreviewColor);
    expect(browserErrors).toEqual([]);
    expect(browserDiagnostics.filter((message) => !knownFirefoxAgrunCspDiagnostic(message))).toEqual([]);
    if (browserDiagnostics.some(knownFirefoxAgrunCspDiagnostic)) test.info().annotations.push({
      type: "known-browser-diagnostic",
      description: "Firefox reports the existing AGRUN CSP eval diagnostic; no functional page error was observed."
    });
  });
});
