import { expect, test } from "@playwright/test";
import { admitPublicGateway, openEditor, openInspector } from "./studio-v2-helpers.js";

test.describe.configure({ timeout: 180_000 });

test.describe("Studio v2 PROD-02 02-07 Auto-mode control", () => {
  test("auto-applies only eligible in-scope work and preserves human/untrusted boundaries", async ({ page }) => {
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
    await expect(page.locator("#ai-mode-auto")).toHaveAttribute("aria-checked", "true");

    const baseline = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      const design = await window.PrintFormStudioAgent.execute("inspect_design_state");
      return { revision: revision.result.revision, brandColor: design.result.branding.primaryColor };
    });

    await page.evaluate(async () => {
      const { CommandBus } = await import("/studio-v2/core/command-bus.js");
      const control = { runs: 0, designRuns: 0, reviewRuns: 0, reviewCalls: 0, actionCalls: 0, scenarios: [], actionResults: [], actionErrors: [], applyAttempts: [], approvalAttempts: [], prompts: [] };
      const originalExecute = CommandBus.prototype.execute;
      CommandBus.prototype.execute = async function(name, input, context) {
        if (context?.agent && name === "approve_transaction") control.approvalAttempts.push({ transactionId: input?.transactionId });
        if (context?.agent && name === "apply_changes") control.applyAttempts.push({ transactionId: input?.transactionId });
        return originalExecute.call(this, name, input, context);
      };
      let runtimeOptions;
      const session = {
        getState: () => ({ cumulativeUsage: { totalTokens: 0 } }),
        runStream(input, runOptions = {}) {
          control.runs += 1;
          control.prompts.push(input?.prompt || "");
          return (async function* () {
            runOptions.onToken?.("Controlled Auto-mode outcome");
            if (input?.prompt?.includes("bounded multimodal layout review pass")) {
              const complete = runtimeOptions.customActions.find((item) => item.name === "printform_complete_current_layout_review");
              if (!complete) throw new Error("Layout completion action was not registered");
              control.reviewRuns += 1;
              control.reviewCalls += 1;
              await complete.execute({}, { findings: [], summary: "Controlled clean layout review" });
              yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: "Review complete" } } } };
              return;
            }
            const scenario = control.scenarios[control.designRuns];
            control.designRuns += 1;
            const action = runtimeOptions.customActions.find((item) => item.name === "printform_preview_changes");
            if (!action) throw new Error("Preview action was not registered");
            const revision = await window.PrintFormStudioAgent.execute("get_revision");
            control.actionCalls += 1;
            try {
              const result = await action.execute({}, { expectedRevision: revision.result.revision, operations: scenario.operations });
              control.actionResults.push({ name: scenario.name, result });
            } catch (error) {
              control.actionErrors.push({ name: scenario.name, code: error.code, message: error.message });
              throw error;
            }
            yield { type: "phase", detail: { phase: "act", transition: "completed", info: { actionName: "printform_preview_changes", outcome: "executed" } } };
            yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: "Controlled outcome ready" } } } };
          }());
        }
      };
      window.__p0Prod0207 = control;
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
    });

    const runScenario = async (name, operations, prompt) => {
      const expectedRun = await page.evaluate(() => window.__p0Prod0207.designRuns + 1);
      await page.evaluate(({ name: nextName, operations: nextOperations }) => {
        window.__p0Prod0207.scenarios.push({ name: nextName, operations: nextOperations });
      }, { name, operations });
      await page.locator("#ai-prompt").fill(prompt);
      await page.locator("#ai-send").click();
      await expect.poll(() => page.evaluate(() => window.__p0Prod0207.designRuns)).toBe(expectedRun);
    };

    await page.locator("#ai-context-scope-select").selectOption("theme");
    await runScenario("eligible-theme", [{ type: "set_brand_color", hex: "#854d0e" }], "Apply the eligible theme colour");
    await expect(page.locator("#revision-label")).toHaveText(`Revision ${baseline.revision + 1}`);
    await expect(page.locator(".ai-card-applied")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".ai-card-status-badge")).toHaveText(/Revision 1/);
    await expect.poll(() => page.evaluate(() => window.__p0Prod0207.reviewRuns)).toBe(1);
    await expect(page.locator("#ai-send")).toBeEnabled();
    const eligible = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      const design = await window.PrintFormStudioAgent.execute("inspect_design_state");
      return { revision: revision.result.revision, brandColor: design.result.branding.primaryColor, control: window.__p0Prod0207 };
    });
    expect(eligible.revision).toBe(baseline.revision + 1);
    expect(eligible.brandColor).toBe("#854d0e");
    expect(eligible.control.actionResults[0].result.control).toBe("complete");
    expect(eligible.control.approvalAttempts).toHaveLength(1);
    expect(eligible.control.applyAttempts).toHaveLength(1);

    await page.locator("#ai-context-scope-select").selectOption("all");
    await runScenario("ineligible", [{ type: "set_asset_slot", slot: "letterhead-logo", source: "data:image/png;base64,AAAA" }], "Keep this in preview because it is not Auto eligible");
    await expect(page.locator(".ai-card-pending")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#ai-apply-proposal")).toHaveCount(0);
    await expect.poll(() => page.evaluate(async () => (await window.PrintFormStudioAgent.execute("get_revision")).result.revision)).toBe(baseline.revision + 1);
    await page.locator("#ai-mode-preview").click();
    await page.locator("#ai-reject-proposal").click();
    await expect(page.locator("#ai-proposal-card")).toBeHidden();
    await page.locator("#ai-mode-auto").click();

    await runScenario("mixed", [
      { type: "set_brand_color", hex: "#0f766e" },
      { type: "set_asset_slot", slot: "letterhead-logo", source: "data:image/png;base64,AAAA" }
    ], "Keep a mixed eligible and ineligible batch pending");
    await expect(page.locator(".ai-card-pending")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#ai-apply-proposal")).toHaveCount(0);
    await expect.poll(() => page.evaluate(async () => (await window.PrintFormStudioAgent.execute("get_revision")).result.revision)).toBe(baseline.revision + 1);
    await page.locator("#ai-mode-preview").click();
    await page.locator("#ai-reject-proposal").click();
    await expect(page.locator("#ai-proposal-card")).toBeHidden();
    await page.locator("#ai-mode-auto").click();

    await runScenario("invalid", [{ type: "set_brand_color", hex: "not-a-colour" }], "Reject an invalid Auto candidate");
    await expect.poll(() => page.evaluate(() => window.__p0Prod0207.actionErrors.length)).toBe(1);
    await expect(page.locator("#ai-proposal-card")).toBeHidden();
    await expect.poll(() => page.evaluate(async () => (await window.PrintFormStudioAgent.execute("get_revision")).result.revision)).toBe(baseline.revision + 1);

    await page.locator("#ai-context-scope-select").selectOption("theme");
    await runScenario("out-of-scope", [{ type: "set_font_scale", basePt: 10 }], "Reject an out-of-scope Auto candidate");
    await expect.poll(() => page.evaluate(() => window.__p0Prod0207.actionErrors.length)).toBe(2);
    await expect(page.locator("#ai-proposal-card")).toBeHidden();
    await expect.poll(() => page.evaluate(async () => (await window.PrintFormStudioAgent.execute("get_revision")).result.revision)).toBe(baseline.revision + 1);

    await openEditor(page);
    await page.locator("#template-editor").evaluate((editor) => {
      const marker = '<script type="application/json" data-p0-human-source="true">{}</script>';
      if (!editor.value.includes("data-p0-human-source")) editor.value = `${editor.value}\n${marker}`;
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.locator("#apply-source-button").click();
    await expect(page.locator("#source-diff-modal")).toBeVisible();
    await page.locator("#source-diff-apply").click();
    const afterHumanSource = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      const summary = await window.PrintFormStudioAgent.execute("get_project_summary");
      return { revision: revision.result.revision, trust: summary.result.trust };
    });
    expect(afterHumanSource.revision).toBe(baseline.revision + 2);
    expect(afterHumanSource.trust).toBe("untrusted");
    const blocked = await page.evaluate(() => window.PrintFormStudioAgent.execute("apply_changes", { expectedRevision: 0 }));
    expect(blocked).toMatchObject({ ok: false, error: { code: "UNTRUSTED_READ_ONLY" } });
    const final = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      return { revision: revision.result.revision, control: window.__p0Prod0207 };
    });
    expect(final.revision).toBe(baseline.revision + 2);
    expect(final.control.runs).toBe(6);
    expect(final.control.designRuns).toBe(5);
    expect(final.control.reviewRuns).toBe(1);
    expect(final.control.actionCalls).toBe(5);
    expect(final.control.actionResults.map((item) => item.name)).toEqual(["eligible-theme", "ineligible", "mixed"]);
    expect(final.control.actionErrors.map((item) => item.code)).toEqual(["INVALID_OPERATION_SHAPE", "SCOPE_VIOLATION"]);
    expect(browserErrors).toEqual([]);
    expect(browserDiagnostics.filter((message) => !knownFirefoxAgrunCspDiagnostic(message))).toEqual([]);
    if (browserDiagnostics.some(knownFirefoxAgrunCspDiagnostic)) test.info().annotations.push({
      type: "known-browser-diagnostic",
      description: "Firefox reports the existing AGRUN CSP eval diagnostic; no functional page error was observed."
    });
  });
});
