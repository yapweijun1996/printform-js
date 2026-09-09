import { expect, test } from "@playwright/test";
import { admitPublicGateway, openInspector } from "./studio-v2-helpers.js";

test.describe.configure({ timeout: 180_000 });

test.describe("Studio v2 S09 PROD-04 04-01 card history guards", () => {
  test("keeps card Undo and Redo bound to their applied revision", async ({ page }) => {
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
      return { revision: revision.result.revision, projectHash: revision.result.projectHash, brandColor: design.result.branding.primaryColor };
    });

    await page.evaluate((baselineRevision) => {
      const control = { runs: 0, actionCalls: 0, actionResult: null, historyCalls: [] };
      let runtimeOptions;
      const session = {
        getState: () => ({ cumulativeUsage: { totalTokens: 0 } }),
        runStream(input, runOptions = {}) {
          control.runs += 1;
          return (async function* () {
            runOptions.onToken?.("Controlled history card proposal");
            const action = runtimeOptions.customActions.find((item) => item.name === "printform_preview_changes");
            if (!action) throw new Error("Preview action was not registered");
            control.actionCalls += 1;
            control.actionResult = await action.execute({}, {
              expectedRevision: baselineRevision,
              operations: [{ type: "set_brand_color", hex: "#854d0e" }]
            });
            yield { type: "phase", detail: { phase: "act", transition: "completed", info: { actionName: "printform_preview_changes", outcome: "executed" } } };
            yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: "Proposal ready" } } } };
          }());
        }
      };
      window.__s09Prod0401 = control;
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

    await page.evaluate(async () => {
      const { CommandBus } = await import("/studio-v2/core/command-bus.js");
      const control = window.__s09Prod0401;
      const originalExecute = CommandBus.prototype.execute;
      CommandBus.prototype.execute = async function(name, input, context) {
        const result = await originalExecute.call(this, name, input, context);
        if (name === "undo_revision" || name === "redo_revision") {
          control.historyCalls.push({
            name,
            input: { expectedRevision: input?.expectedRevision },
            ok: result.ok,
            changed: result.result?.changed,
            revision: result.result?.revision,
            errorCode: result.error?.code,
            actualRevision: result.error?.actualRevision
          });
        }
        return result;
      };
    });

    await page.locator("#ai-prompt").fill("Apply one safe amber brand colour");
    await page.locator("#ai-send").click();
    await expect(page.locator(".ai-card-pending")).toBeVisible({ timeout: 20_000 });
    await page.locator("#ai-apply-proposal").click();
    await expect(page.locator(".ai-card-applied")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".ai-card-status-badge")).toHaveText(/Revision 1/);

    await page.locator(".ai-card-undo").click();
    await expect(page.locator("#revision-label")).toHaveText(`Revision ${baseline.revision + 2}`);
    await expect(page.locator(".ai-card-reverted")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".ai-card-redo")).toBeVisible();
    const afterUndo = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      const design = await window.PrintFormStudioAgent.execute("inspect_design_state");
      return { revision: revision.result.revision, projectHash: revision.result.projectHash, brandColor: design.result.branding.primaryColor, historyCalls: window.__s09Prod0401.historyCalls };
    });
    expect(afterUndo.revision).toBe(baseline.revision + 2);
    expect(afterUndo.brandColor).toBe(baseline.brandColor);
    expect(afterUndo.historyCalls).toHaveLength(1);
    expect(afterUndo.historyCalls[0]).toMatchObject({ name: "undo_revision", input: { expectedRevision: baseline.revision + 1 }, ok: true, changed: true, revision: baseline.revision + 2 });

    await page.locator(".ai-card-redo").click();
    await expect(page.locator("#revision-label")).toHaveText(`Revision ${baseline.revision + 3}`);
    await expect(page.locator(".ai-card-applied")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".ai-card-status-badge")).toHaveText(/Revision 3/);
    const afterRedo = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      const design = await window.PrintFormStudioAgent.execute("inspect_design_state");
      return { revision: revision.result.revision, projectHash: revision.result.projectHash, brandColor: design.result.branding.primaryColor, historyCalls: window.__s09Prod0401.historyCalls };
    });
    expect(afterRedo.revision).toBe(baseline.revision + 3);
    expect(afterRedo.brandColor).toBe("#854d0e");
    expect(afterRedo.historyCalls).toHaveLength(2);
    expect(afterRedo.historyCalls[1]).toMatchObject({ name: "redo_revision", input: { expectedRevision: baseline.revision + 2 }, ok: true, changed: true, revision: baseline.revision + 3 });

    await page.locator("#ai-mode-auto").click();
    await expect(page.locator("#ai-mode-auto")).toHaveAttribute("aria-checked", "true");
    const unrelated = await page.evaluate(async () => {
      const summary = await window.PrintFormStudioAgent.execute("get_project_summary");
      const preview = await window.PrintFormStudioAgent.execute("preview_changes", { expectedRevision: summary.result.revision, operations: [{ type: "set_font_scale", basePt: 14 }] });
      const approved = await window.PrintFormStudioAgent.execute("approve_transaction", { expectedRevision: summary.result.revision, transactionId: preview.result.transactionId, expectedCandidateHash: preview.result.candidateHash, requireValid: false });
      const applied = await window.PrintFormStudioAgent.execute("apply_changes", { expectedRevision: summary.result.revision, transactionId: preview.result.transactionId, expectedCandidateHash: preview.result.candidateHash, reason: "S09 unrelated committed revision" });
      return { preview, approved, applied };
    });
    expect(unrelated.preview.ok).toBe(true);
    expect(unrelated.approved.ok).toBe(true);
    expect(unrelated.applied.ok).toBe(true);
    await expect(page.locator("#revision-label")).toHaveText(`Revision ${baseline.revision + 4}`);
    await expect(page.locator(".ai-card-applied")).toBeVisible();
    await expect(page.locator(".ai-card-status-badge")).toHaveText(/Revision 3/);
    const currentBeforeStaleUndo = await page.evaluate(async () => (await window.PrintFormStudioAgent.execute("get_revision")).result);

    await page.locator(".ai-card-undo").click();
    await expect.poll(() => page.evaluate(() => window.__s09Prod0401.historyCalls.length)).toBe(3);
    const afterStaleUndo = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      const design = await window.PrintFormStudioAgent.execute("inspect_design_state");
      return { revision: revision.result.revision, projectHash: revision.result.projectHash, brandColor: design.result.branding.primaryColor, historyCalls: window.__s09Prod0401.historyCalls };
    });
    expect(afterStaleUndo).toMatchObject({ revision: currentBeforeStaleUndo.revision, projectHash: currentBeforeStaleUndo.projectHash, brandColor: "#854d0e" });
    expect(afterStaleUndo.historyCalls[2]).toMatchObject({ name: "undo_revision", input: { expectedRevision: baseline.revision + 3 }, ok: false, errorCode: "REVISION_CONFLICT", actualRevision: baseline.revision + 4 });
    await expect(page.locator(".ai-card-applied")).toBeVisible();
    await expect(page.locator(".ai-card-status-badge")).toHaveText(/Revision 3/);
    await expect(page.locator(".ai-card-undo")).toBeVisible();
    expect(browserErrors).toEqual([]);
    expect(browserDiagnostics.filter((message) => !knownFirefoxAgrunCspDiagnostic(message))).toEqual([]);
    if (browserDiagnostics.some(knownFirefoxAgrunCspDiagnostic)) test.info().annotations.push({
      type: "known-browser-diagnostic",
      description: "Firefox reports the existing AGRUN CSP eval diagnostic; no functional page error was observed."
    });
  });
});
