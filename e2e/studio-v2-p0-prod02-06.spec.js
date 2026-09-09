import { expect, test } from "@playwright/test";
import { admitPublicGateway, openInspector } from "./studio-v2-helpers.js";

test.describe.configure({ timeout: 180_000 });

test.describe("Studio v2 PROD-02 02-06 duplicate Apply and unknown outcome", () => {
  test("keeps duplicate, lost-response and validation outcomes truthful", async ({ page }) => {
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
      const design = await window.PrintFormStudioAgent.execute("inspect_design_state");
      return { revision: revision.result.revision, brandColor: design.result.branding.primaryColor };
    });

    await page.evaluate(async (baseRevision) => {
      const { CommandBus } = await import("/studio-v2/core/command-bus.js");
      const control = {
        baseRevision, fault: "lost", runs: 0, actionCalls: 0, applyAttempts: [], approvalAttempts: [], applyCalls: [], getTransactionCalls: [],
        actionResults: [], prompts: [], lost: false, lostRecoveryWaiting: false,
        lostRecoveryReleased: false, unknownInjected: false, doubleClickDispatched: 0
      };
      const originalExecute = CommandBus.prototype.execute;
      const originalMaybeFail = CommandBus.prototype.maybeFail;
      CommandBus.prototype.execute = async function(name, input, context) {
        if (name === "apply_changes") control.applyAttempts.push({ transactionId: input?.transactionId });
        if (name === "approve_transaction") control.approvalAttempts.push({ transactionId: input?.transactionId });
        const result = await originalExecute.call(this, name, input, context);
        if (name === "apply_changes") control.applyCalls.push({ transactionId: input?.transactionId, result });
        if (name === "get_transaction") control.getTransactionCalls.push({ transactionId: input?.transactionId, result });
        if (name === "apply_changes" && control.fault === "lost" && !control.lost) {
          control.lost = true;
          throw Object.assign(new Error("Synthetic commit response loss"), { code: "COMMIT_RESPONSE_LOST" });
        }
        if (name === "validate_project" && control.fault === "validation") {
          return { ok: false, error: { code: "VALIDATION_UNAVAILABLE", message: "Command failed" } };
        }
        return result;
      };
      CommandBus.prototype.maybeFail = function(phase) {
        if (phase === "after_revision_write" && control.fault === "unknown" && !control.unknownInjected) {
          control.unknownInjected = true;
          const error = Object.assign(new Error("Synthetic post-write interruption"), { code: "INJECTED_CRASH", phase });
          throw error;
        }
        return originalMaybeFail.call(this, phase);
      };

      let runtimeOptions;
      const session = {
        getState: () => ({ cumulativeUsage: { totalTokens: 0 } }),
        runStream(input, runOptions = {}) {
          const run = ++control.runs;
          control.prompts.push(input?.prompt || "");
          return (async function* () {
            runOptions.onToken?.("Controlled outcome");
            const action = runtimeOptions.customActions.find((item) => item.name === "printform_preview_changes");
            if (!action) throw new Error("Preview action was not registered");
            control.actionCalls += 1;
            const result = await action.execute({}, {
              expectedRevision: baseRevision + run - 1,
              operations: [{ type: "set_brand_color", hex: ["#854d0e", "#0f766e", "#be123c"][run - 1] }]
            });
            control.actionResults.push(result);
            yield { type: "phase", detail: { phase: "act", transition: "completed", info: { actionName: "printform_preview_changes", outcome: "executed" } } };
            yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: "Outcome ready" } } } };
          }());
        }
      };
      window.__p0Prod0206 = control;
      window.__p0Prod0206ReleaseLost = () => { control.lostRecoveryReleased = true; control.releaseLost?.(); };
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

      const executeWithLostGate = CommandBus.prototype.execute;
      CommandBus.prototype.execute = async function(name, input, context) {
        if (name === "get_transaction" && control.fault === "lost" && !control.lostRecoveryReleased) {
          control.lostRecoveryWaiting = true;
          await new Promise((resolve) => { control.releaseLost = resolve; });
        }
        return executeWithLostGate.call(this, name, input, context);
      };
    }, baseline.revision);

    await page.locator("#ai-prompt").fill("Apply the first controlled brand colour");
    await page.locator("#ai-send").click();
    await expect(page.locator("#ai-apply-proposal")).toBeVisible({ timeout: 20_000 });
    await page.locator("#ai-apply-proposal").click();
    await expect.poll(() => page.evaluate(() => window.__p0Prod0206?.lostRecoveryWaiting)).toBe(true);
    await page.evaluate(() => {
      const button = document.querySelector("#ai-apply-proposal");
      window.__p0Prod0206.doubleClickDispatched = 2;
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await page.evaluate(() => window.__p0Prod0206ReleaseLost());
    await expect(page.locator("#revision-label")).toHaveText("Revision " + (baseline.revision + 1));
    await expect(page.locator(".ai-card-applied")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".ai-card-status-badge")).toHaveText(/Revision 1/);
    await expect(page.locator("#ai-status")).toHaveText(/Applied|validation/i);
    const afterLost = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      return { revision: revision.result.revision, control: window.__p0Prod0206 };
    });
    expect(afterLost.revision).toBe(baseline.revision + 1);
    expect(afterLost.control.doubleClickDispatched).toBe(2);
    expect(afterLost.control.approvalAttempts.length).toBe(1);
    expect(afterLost.control.applyAttempts.length).toBe(1);
    expect(afterLost.control.applyCalls.map((call) => call.transactionId)).toEqual(expect.arrayContaining([expect.any(String)]));
    expect(afterLost.control.applyCalls.map((call) => call.transactionId).filter(Boolean).length).toBe(1);

    await page.evaluate(() => { window.__p0Prod0206.fault = "validation"; });
    await page.locator("#ai-prompt").fill("Apply the second controlled brand colour");
    await page.locator("#ai-send").click();
    await expect(page.locator("#ai-apply-proposal")).toBeVisible({ timeout: 20_000 });
    await page.locator("#ai-apply-proposal").click();
    await expect(page.locator("#revision-label")).toHaveText("Revision " + (baseline.revision + 2));
    await expect(page.locator(".ai-card-applied")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".ai-card-status-badge")).toHaveText(/Revision 2/);
    await expect(page.locator("#ai-status")).toHaveText(/validation/i);
    const afterValidation = await page.evaluate(() => window.__p0Prod0206);
    expect(afterValidation.actionResults[1].control).toBe("complete");

    await page.evaluate(() => {
      window.__p0Prod0206.fault = "unknown";
      window.__p0Prod0206.unknownInjected = false;
    });
    await page.locator("#ai-prompt").fill("Apply the third controlled brand colour");
    await page.locator("#ai-send").click();
    await expect(page.locator("#ai-apply-proposal")).toBeVisible({ timeout: 20_000 });
    await page.locator("#ai-apply-proposal").click();
    await expect(page.locator(".ai-card-recovery")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".ai-card-applied")).toHaveCount(0);
    await expect(page.locator("#ai-apply-proposal")).toHaveCount(0);
    await expect(page.locator("#ai-reject-proposal")).toHaveCount(0);
    await expect(page.locator("#ai-status")).toHaveText(/recovery|uncertain/i);
    const afterUnknown = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      return { revision: revision.result.revision, control: window.__p0Prod0206 };
    });
    expect(afterUnknown.revision).toBe(baseline.revision + 3);
    expect(afterUnknown.control.applyAttempts.length).toBe(3);
    expect(afterUnknown.control.runs).toBe(3);
    expect(afterUnknown.control.prompts).toEqual([
      "Apply the first controlled brand colour",
      "Apply the second controlled brand colour",
      "Apply the third controlled brand colour"
    ]);
    expect(afterUnknown.control.actionCalls).toBe(3);
    expect(afterUnknown.control.actionResults.every((result) => result.control === "complete")).toBe(true);
    expect(browserErrors).toEqual([]);
    expect(browserDiagnostics.filter((message) => !knownFirefoxAgrunCspDiagnostic(message))).toEqual([]);
    if (browserDiagnostics.some(knownFirefoxAgrunCspDiagnostic)) test.info().annotations.push({
      type: "known-browser-diagnostic",
      description: "Firefox reports the existing AGRUN CSP eval diagnostic; no functional page error was observed."
    });
  });
});
