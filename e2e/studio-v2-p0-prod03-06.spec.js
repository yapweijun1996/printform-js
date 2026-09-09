import { expect, test } from "@playwright/test";
import { admitPublicGateway, openInspector, passLayoutReview } from "./studio-v2-helpers.js";

test.describe.configure({ timeout: 180_000 });

async function run(page, name, input = {}) {
  return page.evaluate(({ command, payload }) => window.PrintFormStudioAgent.execute(command, payload), { command: name, payload: input });
}

async function previewBrandColor(page) {
  return page.frameLocator("#preview-frame").locator(".pf-brand").first().evaluate((node) => getComputedStyle(node).color);
}

test.describe("Studio v2 PROD-03 03-06 candidate separation", () => {
  test("keeps a reviewed committed export distinct while a candidate is displayed, then restores it on Discard", async ({ page }) => {
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

    const reviewed = await passLayoutReview(page);
    expect(reviewed.ok).toBe(true);
    expect(reviewed.result.review.reviewedRevision).toBe(0);
    const baseline = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      const readiness = await window.PrintFormStudioAgent.execute("request_export");
      return { revision: revision.result.revision, projectHash: revision.result.projectHash, readiness };
    });
    expect(baseline.readiness.result.ready).toBe(true);
    const committedColor = await previewBrandColor(page);

    await page.locator("#ai-mode-preview").click();
    await page.evaluate((expectedRevision) => {
      const control = { runs: 0, actionCalls: [], callbacks: [] };
      let runtimeOptions;
      const session = {
        getState: () => ({ cumulativeUsage: { totalTokens: 0 } }),
        runStream(_input, runOptions = {}) {
          control.runs += 1;
          return (async function* () {
            const action = runtimeOptions.customActions.find((item) => item.name === "printform_preview_changes");
            if (!action) throw new Error("Preview action was not registered");
            control.actionCalls.push(action.name);
            await action.execute({}, { expectedRevision, operations: [{ type: "set_brand_color", hex: "#854d0e" }] });
            control.callbacks.push("action-complete");
            yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: "Candidate ready" } } } };
            runOptions.onToken?.("Candidate ready");
            control.callbacks.push("completed-yielded");
          }());
        }
      };
      window.__p0Prod0306 = control;
      window.Agrun = {
        defineAction: (definition) => definition,
        createInMemorySessionStore: () => ({}),
        createRuntime: (options) => {
          runtimeOptions = options;
          return { createSession: async () => session, openSession: async () => session, getAgentSkills: () => [] };
        },
        openaiBrowserSkill: {},
        geminiBrowserSkill: {}
      };
    }, baseline.revision);

    await page.locator("#ai-prompt").fill("Preview a warm amber brand colour");
    await page.locator("#ai-send").click();
    await expect(page.locator("#ai-reject-proposal")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#candidate-preview-banner")).toBeVisible();
    await expect(page.locator("#ai-context-state")).toHaveText(/Candidate/i);
    await expect(page.locator("#ai-context-revision")).toHaveText("r0");
    await expect(page.locator("#candidate-preview-banner")).toContainText(/not yet committed/i);
    const candidateColor = await previewBrandColor(page);
    expect(candidateColor).not.toBe(committedColor);

    const candidateState = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      const readiness = await window.PrintFormStudioAgent.execute("request_export");
      return { revision: revision.result, readiness, control: window.__p0Prod0306 };
    });
    expect(candidateState.revision.revision).toBe(baseline.revision);
    expect(candidateState.revision.projectHash).toBe(baseline.projectHash);
    expect(candidateState.readiness.result).toMatchObject({ revision: baseline.revision, ready: true, requiresUserConfirmation: true });
    expect(candidateState.control).toMatchObject({ runs: 1, actionCalls: ["printform_preview_changes"] });

    const dialogs = [];
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.message());
      if (/Save As|另存为/i.test(dialog.message())) await dialog.dismiss();
      else await dialog.accept();
    });
    const downloadEvent = page.waitForEvent("download");
    await page.locator("#export-button").click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe("sales-invoice-pilot.html");
    const stream = await download.createReadStream();
    let html = "";
    for await (const chunk of stream) html += chunk.toString();
    const attestationMatch = html.match(/<script id="pf-attestation" type="application\/json">([\s\S]*?)<\/script>/);
    expect(attestationMatch).not.toBeNull();
    const attestation = JSON.parse(attestationMatch[1]);
    expect(attestation.evidence).toMatchObject({ revision: baseline.revision, validation: { status: "PASS" } });
    expect(attestation.evidence.revision).not.toBe(1);
    expect(dialogs.some((message) => /production-valid HTML|system print preview/i.test(message))).toBe(true);
    await expect(page.locator("#candidate-preview-banner")).toBeVisible();

    await page.locator("#ai-reject-proposal").click();
    await expect(page.locator("#candidate-preview-banner")).toBeHidden();
    await expect(page.locator("#ai-context-state")).toHaveText(/Committed/i);
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    const restoredColor = await previewBrandColor(page);
    expect(restoredColor).toBe(committedColor);
    const restored = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      const readiness = await window.PrintFormStudioAgent.execute("request_export");
      return { revision: revision.result, readiness, control: window.__p0Prod0306 };
    });
    expect(restored.revision).toMatchObject({ revision: baseline.revision, projectHash: baseline.projectHash });
    expect(restored.readiness.result).toMatchObject({ revision: baseline.revision, ready: true });
    expect(restored.control.callbacks).toEqual(["action-complete", "completed-yielded"]);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors.filter((message) => !knownFirefoxAgrunCspDiagnostic(message))).toEqual([]);
    if (consoleErrors.some(knownFirefoxAgrunCspDiagnostic)) test.info().annotations.push({
      type: "known-browser-diagnostic",
      description: "Firefox reports the existing AGRUN CSP eval diagnostic; no functional page error was observed."
    });
  });
});
