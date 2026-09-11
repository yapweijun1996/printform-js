import { expect, test } from "@playwright/test";
import { admitPublicGateway, openInspector } from "./studio-v2-helpers.js";

test.describe.configure({ timeout: 180_000 });

test.describe("Studio v2 PROD-02 02-02 Review repair", () => {
  test("requires a new approval for each Review repair pass", async ({ page }) => {
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
      return { revision: revision.result.revision, projectHash: revision.result.projectHash };
    });

    await page.evaluate((baselineRevision) => {
      const control = { runs: 0, actionCalls: [], callbacks: [], proposals: [], inputs: [] };
      let runtimeOptions;
      const session = {
        getState: () => ({ cumulativeUsage: { totalTokens: 0 } }),
        runStream(input, runOptions = {}) {
          control.runs += 1;
          control.inputs.push({ partCount: input?.parts?.length || 0, hasPrompt: Boolean(input?.prompt) });
          const turn = control.runs;
          return (async function* () {
            control.callbacks.push(`start-${turn}`);
            runOptions.onToken?.(`Review pass ${turn}`);
            control.callbacks.push(`token-${turn}`);
            const actionName = turn < 3 ? "printform_preview_layout_repair" : "printform_complete_current_layout_review";
            const action = runtimeOptions.customActions.find((item) => item.name === actionName);
            if (!action) throw new Error(`${actionName} was not registered`);
            control.actionCalls.push(actionName);
            const args = turn < 3 ? {
              operations: turn === 1
                ? [{ type: "set_brand_color", hex: "#854d0e" }]
                : [{ type: "set_font_scale", basePt: 10 }],
              findings: [{ code: `REVIEW_PASS_${turn}`, severity: "major", status: "open", message: `Controlled repair ${turn}` }],
              summary: `Controlled repair pass ${turn}`
            } : { findings: [], summary: "Controlled review complete" };
            const result = await action.execute({}, args);
            if (result?.output?.transactionId) control.proposals.push({ turn, transactionId: result.output.transactionId });
            control.callbacks.push(`action-${turn}`);
            yield { type: "phase", detail: { phase: "act", transition: "completed", info: { actionName, outcome: "executed" } } };
            control.callbacks.push(`phase-${turn}`);
            yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: `Review pass ${turn} complete` } } } };
            control.callbacks.push(`complete-${turn}`);
          }());
        }
      };
      window.__p0Prod0202 = control;
      window.Agrun = {
        defineAction: (definition) => definition,
        createInMemorySessionStore: () => ({}),
        createRuntime: (options) => {
          runtimeOptions = options;
          return { runStream: (input, runOptions) => session.runStream(input, runOptions), createSession: async () => session, openSession: async () => session, getAgentSkills: () => [] };
        },
        openaiBrowserSkill: {},
        geminiBrowserSkill: {}
      };
    }, baseline.revision);

    await page.locator("#ai-review-layout").click();
    await expect(page.locator("#ai-apply-proposal")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#ai-status")).toHaveText(/Preview ready/i);
    const firstProposal = await page.locator(".ai-change-card").getAttribute("data-proposal-id");
    const pending = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      return { revision: revision.result.revision, projectHash: revision.result.projectHash, control: window.__p0Prod0202 };
    });
    expect(pending.revision).toBe(baseline.revision);
    expect(pending.projectHash).toBe(baseline.projectHash);
    expect(pending.control).toMatchObject({ runs: 1, actionCalls: ["printform_preview_layout_repair"] });
    expect(pending.control.proposals).toHaveLength(1);
    expect(pending.control.inputs[0].partCount).toBeGreaterThan(0);
    expect(pending.control.callbacks).toEqual(["start-1", "token-1", "action-1", "phase-1", "complete-1"]);

    await page.locator("#ai-apply-proposal").click();
    await expect(page.locator("#revision-label")).toHaveText(`Revision ${baseline.revision + 1}`);
    await expect(page.locator("#ai-apply-proposal")).toBeVisible({ timeout: 30_000 });
    const secondProposal = await page.locator(".ai-change-card").getAttribute("data-proposal-id");
    const secondPending = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      return { revision: revision.result.revision, projectHash: revision.result.projectHash, control: window.__p0Prod0202 };
    });
    expect(secondProposal).toBeTruthy();
    expect(secondProposal).not.toBe(firstProposal);
    expect(secondPending.revision).toBe(baseline.revision + 1);
    expect(secondPending.projectHash).not.toBe(baseline.projectHash);
    expect(secondPending.control).toMatchObject({ runs: 2, actionCalls: ["printform_preview_layout_repair", "printform_preview_layout_repair"] });
    expect(secondPending.control.proposals).toHaveLength(2);
    expect(secondPending.control.callbacks).toEqual([
      "start-1", "token-1", "action-1", "phase-1", "complete-1",
      "start-2", "token-2", "action-2", "phase-2", "complete-2"
    ]);
    const secondDiff = JSON.parse(await page.locator("#ai-proposal-diff").textContent());
    expect(secondDiff.revision).toBe(baseline.revision + 1);
    expect(secondDiff.diff.changed).toBe(true);
    await expect(page.locator("#candidate-preview-banner")).toBeVisible();

    await page.locator("#ai-apply-proposal").click();
    await expect(page.locator("#revision-label")).toHaveText(`Revision ${baseline.revision + 2}`);
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await expect(page.locator(".ai-card-applied")).toBeVisible();
    await expect(page.locator(".ai-card-undo")).toBeVisible();
    await expect(page.locator("#ai-apply-proposal")).toHaveCount(0);
    await expect(page.locator("#ai-status")).toHaveText(/Ready|Applied|review/i);

    const committed = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      return { revision: revision.result.revision, projectHash: revision.result.projectHash, control: window.__p0Prod0202 };
    });
    expect(committed.revision).toBe(baseline.revision + 2);
    expect(committed.projectHash).not.toBe(secondPending.projectHash);
    expect(committed.control).toMatchObject({ runs: 3, actionCalls: [
      "printform_preview_layout_repair", "printform_preview_layout_repair", "printform_complete_current_layout_review"
    ] });
    expect(committed.control.proposals).toHaveLength(2);
    expect(committed.control.callbacks).toEqual([
      "start-1", "token-1", "action-1", "phase-1", "complete-1",
      "start-2", "token-2", "action-2", "phase-2", "complete-2",
      "start-3", "token-3", "action-3", "phase-3", "complete-3"
    ]);
    expect(browserErrors).toEqual([]);
    expect(browserDiagnostics.filter((message) => !knownFirefoxAgrunCspDiagnostic(message))).toEqual([]);
    if (browserDiagnostics.some(knownFirefoxAgrunCspDiagnostic)) test.info().annotations.push({
      type: "known-browser-diagnostic",
      description: "Firefox reports the existing AGRUN CSP eval diagnostic; no functional page error was observed."
    });
  });
});
