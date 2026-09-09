import { expect, test } from "@playwright/test";
import { admitPublicGateway, openInspector } from "./studio-v2-helpers.js";

test.describe.configure({ timeout: 180_000 });

test.describe("Studio v2 PROD-02 02-08 host/prompt/export agreement", () => {
  test("keeps prompt and panel states policy-bound until human production export", async ({ page }) => {
    const browserErrors = [];
    const browserDiagnostics = [];
    const knownFirefoxAgrunCspDiagnostic = (message) => test.info().project.name === "firefox"
      && /Content-Security-Policy:[\s\S]*blocked a JavaScript eval[\s\S]*agrun\.min\.js/i.test(message);
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") browserDiagnostics.push(message.text()); });

    await page.goto("/studio-v2/?sample=sales-invoice");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await openInspector(page);
    await page.locator("#ai-designer-tab").click();
    await admitPublicGateway(page);
    await page.locator("#ai-mode-preview").click();

    const baseline = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      return revision.result.revision;
    });

    await page.evaluate(async () => {
      const { CommandBus } = await import("/studio-v2/core/command-bus.js");
      const control = {
        applyCalls: 0, applyGate: false, releaseApply: null, designRuns: 0, reviewRuns: 0,
        exportRequests: 0, downloadClicks: 0, prompts: [], skillMarkdown: "", agentSkillCount: 0
      };
      const originalExecute = CommandBus.prototype.execute;
      CommandBus.prototype.execute = async function(name, input, context) {
        if (name === "request_export") control.exportRequests += 1;
        if (context?.agent && name === "apply_changes") {
          control.applyCalls += 1;
          if (control.applyGate) await new Promise((resolve) => { control.releaseApply = resolve; });
        }
        return originalExecute.call(this, name, input, context);
      };
      const originalAnchorClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function() {
        if (this.download) control.downloadClicks += 1;
        return originalAnchorClick.call(this);
      };
      let runtimeOptions;
      const session = {
        getState: () => ({ cumulativeUsage: { totalTokens: 0 } }),
        runStream(input, runOptions = {}) {
          control.prompts.push({ prompt: input?.prompt || "", systemPrompt: input?.systemPrompt || "" });
          return (async function* () {
            runOptions.onToken?.("Controlled host agreement outcome");
            if (input?.prompt?.includes("bounded multimodal layout review pass")) {
              control.reviewRuns += 1;
              const complete = runtimeOptions.customActions.find((item) => item.name === "printform_complete_current_layout_review");
              if (!complete) throw new Error("Layout completion action was not registered");
              await complete.execute({}, { findings: [], summary: "Controlled clean layout review" });
              yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: "Review complete" } } } };
              return;
            }
            control.designRuns += 1;
            const action = runtimeOptions.customActions.find((item) => item.name === "printform_preview_changes");
            const revision = await window.PrintFormStudioAgent.execute("get_revision");
            await action.execute({}, { expectedRevision: revision.result.revision, operations: [{ type: "set_brand_color", hex: "#854d0e" }] });
            yield { type: "phase", detail: { phase: "act", transition: "completed", info: { actionName: "printform_preview_changes", outcome: "executed" } } };
            yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: "Preview ready" } } } };
          }());
        }
      };
      window.Agrun = {
        parseSkillMarkdown: (markdown) => {
          control.skillMarkdown = markdown;
          return { name: "printform-designer", instructions: markdown };
        },
        defineAction: (definition) => definition,
        createInMemorySessionStore: () => ({}),
        createRuntime: (options) => {
          runtimeOptions = options;
          control.agentSkillCount = options.agentSkills.length;
          return { createSession: async () => session, openSession: async () => session, getAgentSkills: () => options.agentSkills };
        },
        openaiBrowserSkill: {},
        geminiBrowserSkill: {}
      };
      window.__p0Prod0208 = control;
    });

    await page.locator("#ai-prompt").fill("Apply one safe theme colour");
    await page.locator("#ai-send").click();
    await expect.poll(() => page.evaluate(() => window.__p0Prod0208.designRuns)).toBe(1);
    await expect(page.locator(".ai-card-pending")).toBeVisible();
    await expect(page.locator("#ai-apply-proposal")).toBeVisible();
    const promptEvidence = await page.evaluate(() => window.__p0Prod0208);
    expect(promptEvidence.agentSkillCount).toBe(1);
    expect(promptEvidence.skillMarkdown).toContain("human owns Production Export");
    expect(promptEvidence.prompts[0].systemPrompt).toContain("human must use the Studio Production export UI");
    expect(promptEvidence.prompts[0].systemPrompt).toContain("The host alone checks export readiness");

    await page.evaluate(() => { window.__p0Prod0208.applyGate = true; });
    await page.locator("#ai-apply-proposal").click();
    await expect(page.locator("#ai-status")).toHaveText(/Applying/i);
    await expect.poll(() => page.evaluate(() => window.__p0Prod0208.applyCalls)).toBe(1);
    await expect(page.locator(".ai-card-pending")).toBeVisible();
    expect(await page.evaluate(() => window.__p0Prod0208.downloadClicks)).toBe(0);
    await page.evaluate(() => { window.__p0Prod0208.applyGate = false; window.__p0Prod0208.releaseApply?.(); });
    await expect(page.locator(".ai-card-applied")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#ai-status")).toHaveText(/Applied/i);
    await expect(page.locator("#revision-label")).toHaveText(`Revision ${baseline + 1}`);
    expect(await page.evaluate(() => window.__p0Prod0208.downloadClicks)).toBe(0);

    await page.locator("#ai-review-layout").click();
    await expect.poll(() => page.evaluate(() => window.__p0Prod0208.reviewRuns)).toBe(1);
    await expect(page.locator("#ai-status")).toHaveText(/human print preview and export confirmation remain required/i);
    expect(await page.evaluate(() => window.__p0Prod0208.downloadClicks)).toBe(0);

    let cancelledDialog;
    page.once("dialog", async (dialog) => { cancelledDialog = dialog.message(); await dialog.dismiss(); });
    await page.locator("#export-button").click();
    await expect(page.locator("#save-state")).toHaveText(/cancelled/i);
    expect(cancelledDialog).toMatch(/production-valid HTML|system print preview/i);
    expect(await page.evaluate(() => window.__p0Prod0208.downloadClicks)).toBe(0);

    const acceptedDialogs = [];
    page.on("dialog", async (dialog) => {
      acceptedDialogs.push(dialog.message());
      if (/Save As|另存为/i.test(dialog.message())) await dialog.dismiss();
      else await dialog.accept();
    });
    const downloadEvent = page.waitForEvent("download");
    await page.locator("#export-button").click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe("sales-invoice-pilot.html");
    await expect(page.locator("#save-state")).toHaveText(/Download started/i);
    expect(acceptedDialogs.some((message) => /production-valid HTML|system print preview/i.test(message))).toBe(true);
    expect(await page.evaluate(() => window.__p0Prod0208.downloadClicks)).toBe(1);
    expect(await page.evaluate(() => window.__p0Prod0208.exportRequests)).toBeGreaterThanOrEqual(3);
    expect(browserErrors).toEqual([]);
    expect(browserDiagnostics.filter((message) => !knownFirefoxAgrunCspDiagnostic(message))).toEqual([]);
    if (browserDiagnostics.some(knownFirefoxAgrunCspDiagnostic)) test.info().annotations.push({
      type: "known-browser-diagnostic",
      description: "Firefox reports the existing AGRUN CSP eval diagnostic; no functional page error was observed."
    });
  });
});
