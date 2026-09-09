import { expect, test } from "@playwright/test";
import { admitPublicGateway, openInspector } from "./studio-v2-helpers.js";

test.describe.configure({ timeout: 180_000 });

test.describe("Studio v2 PROD-02 02-05 cancel and retry", () => {
  test("keeps late stopped and discarded responses from committing", async ({ page }) => {
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
      return {
        revision: revision.result.revision,
        projectHash: revision.result.projectHash,
        brandColor: design.result.branding.primaryColor
      };
    });

    await page.evaluate((baselineRevision) => {
      const control = {
        runs: 0,
        actionCalls: 0,
        started: [],
        lateCallbacks: [],
        callbacks: [],
        actionResult: null,
        prompt: ""
      };
      let runtimeOptions;
      const waitForRelease = (name) => new Promise((resolve) => {
        window["__p0Prod0205Release" + name] = resolve;
      });
      const session = {
        getState: () => ({ cumulativeUsage: { totalTokens: 0 } }),
        runStream(input, runOptions = {}) {
          const run = ++control.runs;
          control.prompt = input?.prompt || "";
          control.started.push(run);
          return (async function* () {
            control.callbacks.push("stream-start-" + run);
            if (run === 1) {
              await waitForRelease("Stop");
              control.lateCallbacks.push("stopped-response");
              runOptions.onToken?.("late stopped response");
              control.callbacks.push("late-token-1");
              yield { type: "phase", detail: { phase: "late", transition: "completed", info: { outcome: "ignored-after-stop" } } };
              control.callbacks.push("late-phase-1");
              yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: "late stopped completion" } } } };
              control.callbacks.push("late-completed-1");
              return;
            }

            runOptions.onToken?.("retry proposal");
            control.callbacks.push("token-2");
            const action = runtimeOptions.customActions.find((item) => item.name === "printform_preview_changes");
            if (!action) throw new Error("Preview action was not registered");
            control.actionCalls += 1;
            control.actionResult = await action.execute({}, {
              expectedRevision: baselineRevision,
              operations: [{ type: "set_brand_color", hex: "#854d0e" }]
            });
            control.callbacks.push("action-complete-2");
            yield { type: "phase", detail: { phase: "act", transition: "completed", info: { actionName: "printform_preview_changes", outcome: "executed" } } };
            control.callbacks.push("phase-2");
            await waitForRelease("Discard");
            control.lateCallbacks.push("discarded-retry-response");
            runOptions.onToken?.("late retry callback");
            control.callbacks.push("late-token-2");
            yield { type: "phase", detail: { phase: "late-retry", transition: "completed", info: { outcome: "ignored-after-discard" } } };
            control.callbacks.push("late-phase-2");
            yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: "late retry completion" } } } };
            control.callbacks.push("completed-2");
          }());
        }
      };
      window.__p0Prod0205 = control;
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

    await page.locator("#ai-prompt").fill("Make the form use a warm amber brand colour");
    await page.locator("#ai-send").click();
    await expect.poll(() => page.evaluate(() => window.__p0Prod0205?.runs)).toBe(1);
    await page.locator("#ai-stop").click();
    await expect(page.locator("#ai-stop")).toBeDisabled();
    await expect(page.locator("#ai-send")).toBeEnabled();
    await expect(page.locator("#ai-status")).toHaveText(/Stopped/i);
    await page.evaluate(() => window.__p0Prod0205ReleaseStop?.());
    await expect.poll(() => page.evaluate(() => window.__p0Prod0205?.lateCallbacks.includes("stopped-response"))).toBe(true);
    await expect(page.locator("#ai-proposal-card")).toBeHidden();
    await expect(page.locator(".ai-card-applied")).toHaveCount(0);

    const afterStop = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      const design = await window.PrintFormStudioAgent.execute("inspect_design_state");
      return { revision: revision.result.revision, brandColor: design.result.branding.primaryColor };
    });
    expect(afterStop.revision).toBe(baseline.revision);
    expect(afterStop.brandColor).toBe(baseline.brandColor);

    await page.locator("#ai-prompt").fill("Retry the same warm amber brand colour");
    await page.locator("#ai-send").click();
    await expect.poll(() => page.evaluate(() => window.__p0Prod0205?.runs)).toBe(2);
    await expect(page.locator("#ai-reject-proposal")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#ai-apply-proposal")).toBeVisible();
    await expect(page.locator(".ai-card-status-badge")).toHaveText(/Preview ready/i);

    await page.locator("#ai-reject-proposal").click();
    await expect(page.locator("#ai-proposal-card")).toBeHidden();
    await expect(page.locator(".ai-card-applied")).toHaveCount(0);
    await expect(page.locator("#ai-status")).toHaveText(/Rejected/i);
    await page.evaluate(() => window.__p0Prod0205ReleaseDiscard?.());
    await expect.poll(() => page.evaluate(() => window.__p0Prod0205?.lateCallbacks.includes("discarded-retry-response"))).toBe(true);
    await expect(page.locator("#ai-send")).toBeEnabled();

    const afterDiscard = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      const design = await window.PrintFormStudioAgent.execute("inspect_design_state");
      return { revision: revision.result.revision, brandColor: design.result.branding.primaryColor, control: window.__p0Prod0205 };
    });
    expect(afterDiscard.revision).toBe(baseline.revision);
    expect(afterDiscard.brandColor).toBe(baseline.brandColor);
    expect(afterDiscard.control).toMatchObject({ runs: 2, actionCalls: 1, prompt: "Retry the same warm amber brand colour" });
    expect(afterDiscard.control.lateCallbacks).toEqual(["stopped-response", "discarded-retry-response"]);
    expect(afterDiscard.control.callbacks).toContain("late-token-1");
    expect(afterDiscard.control.callbacks).not.toContain("late-phase-1");
    expect(afterDiscard.control.callbacks).not.toContain("late-completed-1");
    expect(afterDiscard.control.callbacks).toContain("completed-2");
    expect(afterDiscard.control.actionResult.control).toBe("complete");
    expect(browserErrors).toEqual([]);
    expect(browserDiagnostics.filter((message) => !knownFirefoxAgrunCspDiagnostic(message))).toEqual([]);
    if (browserDiagnostics.some(knownFirefoxAgrunCspDiagnostic)) test.info().annotations.push({
      type: "known-browser-diagnostic",
      description: "Firefox reports the existing AGRUN CSP eval diagnostic; no functional page error was observed."
    });
  });
});
