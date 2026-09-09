import { expect, test } from "@playwright/test";
import { admitPublicGateway, openInspector } from "./studio-v2-helpers.js";

test.describe.configure({ timeout: 180_000 });

test.describe("Studio v2 PROD-02 02-01 chat preview", () => {
  test("keeps a chat proposal pending until private human Apply commits once", async ({ page }) => {
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
        source: document.querySelector("#template-editor")?.value || "",
        brandColor: design.result.branding.primaryColor
      };
    });

    await page.evaluate((baselineRevision) => {
      const control = { runs: 0, actionCalls: 0, callbacks: [], actionResult: null, prompt: "" };
      let runtimeOptions;
      const session = {
        getState: () => ({ cumulativeUsage: { totalTokens: 0 } }),
        runStream(input, runOptions = {}) {
          control.runs += 1;
          control.prompt = input?.prompt || "";
          return (async function* () {
            control.callbacks.push("stream-start");
            runOptions.onToken?.("Controlled chat proposal");
            control.callbacks.push("token");
            const action = runtimeOptions.customActions.find((item) => item.name === "printform_preview_changes");
            if (!action) throw new Error("Preview action was not registered");
            control.actionCalls += 1;
            control.actionResult = await action.execute({}, {
              expectedRevision: baselineRevision,
              operations: [{ type: "set_brand_color", hex: "#854d0e" }]
            });
            control.callbacks.push("action-complete");
            yield { type: "phase", detail: { phase: "act", transition: "completed", info: { actionName: "printform_preview_changes", outcome: "executed" } } };
            control.callbacks.push("phase-yielded");
            yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: "Proposal ready" } } } };
            control.callbacks.push("completed-yielded");
          }());
        }
      };
      window.__p0Prod0201 = control;
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
    await expect(page.locator("#ai-apply-proposal")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#candidate-preview-banner")).toBeVisible();
    await expect(page.locator("#ai-status")).toHaveText(/Preview ready/i);

    const pending = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      return {
        revision: revision.result.revision,
        projectHash: revision.result.projectHash,
        source: document.querySelector("#template-editor")?.value || "",
        control: window.__p0Prod0201
      };
    });
    const proposal = JSON.parse(await page.locator("#ai-proposal-diff").textContent());
    expect(pending.revision).toBe(baseline.revision);
    expect(pending.projectHash).toBe(baseline.projectHash);
    expect(pending.source).toBe(baseline.source);
    expect(proposal.revision).toBe(baseline.revision);
    expect(proposal.candidateHash).toEqual(expect.any(String));
    expect(pending.control).toMatchObject({ runs: 1, actionCalls: 1, prompt: "Make the form use a warm amber brand colour" });
    expect(pending.control.callbacks).toEqual(["stream-start", "token", "action-complete", "phase-yielded", "completed-yielded"]);
    expect(pending.control.actionResult.control).toBe("complete");
    await expect(page.locator("#ai-send")).toBeEnabled();
    await expect(page.locator("#ai-stop")).toBeDisabled();

    await page.locator("#ai-apply-proposal").click();
    await expect(page.locator("#revision-label")).toHaveText(`Revision ${baseline.revision + 1}`);
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await expect(page.locator("#candidate-preview-banner")).toBeHidden();
    await expect(page.locator(".ai-card-applied")).toBeVisible();
    await expect(page.locator(".ai-card-undo")).toBeVisible();
    await expect(page.locator("#ai-apply-proposal")).toHaveCount(0);
    await expect(page.locator("#ai-status")).toHaveText(/Applied|validation/i);

    const committed = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      const design = await window.PrintFormStudioAgent.execute("inspect_design_state");
      return {
        revision: revision.result.revision,
        projectHash: revision.result.projectHash,
        source: document.querySelector("#template-editor")?.value || "",
        brandColor: design.result.branding.primaryColor
      };
    });
    expect(committed.revision).toBe(baseline.revision + 1);
    expect(committed.projectHash).not.toBe(baseline.projectHash);
    expect(committed.source).toBe(baseline.source);
    expect(committed.brandColor).toBe("#854d0e");
    expect(committed.brandColor).not.toBe(baseline.brandColor);
    expect(browserErrors).toEqual([]);
    expect(browserDiagnostics.filter((message) => !knownFirefoxAgrunCspDiagnostic(message))).toEqual([]);
    if (browserDiagnostics.some(knownFirefoxAgrunCspDiagnostic)) test.info().annotations.push({
      type: "known-browser-diagnostic",
      description: "Firefox reports the existing AGRUN CSP eval diagnostic; no functional page error was observed."
    });
  });
});
