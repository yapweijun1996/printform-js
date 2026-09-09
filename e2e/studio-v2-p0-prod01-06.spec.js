import { expect, test } from "@playwright/test";
import { admitPublicGateway, openInspector } from "./studio-v2-helpers.js";

test.describe.configure({ timeout: 180_000 });

test.describe("Studio v2 PROD-01 01-06 stale selection", () => {
  test("requires a fresh preview after scope or document changes", async ({ page, request }) => {
    const browserErrors = [];
    const browserDiagnostics = [];
    const knownFirefoxAgrunCspDiagnostic = (message) => test.info().project.name === "firefox"
      && /Content-Security-Policy:[\s\S]*blocked a JavaScript eval[\s\S]*agrun\.min\.js/i.test(message);
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") browserDiagnostics.push(message.text()); });

    await page.goto("/studio-v2/?sample=sales-invoice");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await openInspector(page);
    await expect(page.locator("#ai-context-scope-select option[value='table']")).toHaveCount(1);
    const componentScope = await page.locator("#ai-context-scope-select option").evaluateAll((options) => options
      .map((option) => option.value)
      .find((value) => value.startsWith("component:")));
    expect(componentScope).toBeTruthy();
    await page.locator("#ai-context-scope-select").selectOption("table");
    await admitPublicGateway(page);

    const baseline = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      return { revision: revision.result.revision, projectHash: revision.result.projectHash, source: document.querySelector("#template-editor").value };
    });
    await page.locator("#ai-mode-preview").click();
    await page.evaluate((baselineRevision) => {
      const control = {
        runs: 0,
        actionCalls: 0,
        results: [],
        errors: [],
        nextOperations: [],
        nextExpectedRevision: baselineRevision
      };
      let runtimeOptions;
      const session = {
        getState: () => ({ cumulativeUsage: { totalTokens: 0 } }),
        runStream() {
          control.runs += 1;
          return (async function* () {
            const action = runtimeOptions.customActions.find((item) => item.name === "printform_preview_changes");
            control.actionCalls += 1;
            try {
              control.results.push(await action.execute({}, {
                expectedRevision: control.nextExpectedRevision,
                operations: structuredClone(control.nextOperations)
              }));
            } catch (error) {
              control.errors.push({ code: error.code, message: error.message });
              throw error;
            }
            yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: "Preview ready" } } } };
          }());
        }
      };
      window.__p0Prod0106 = { control };
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

    const allowedOperation = { type: "set_column_widths", tableSelector: ".prowheader, .prowitem", widths: ["12%", "43%", "11%", "16%", "18%"] };
    await page.evaluate((operations) => { window.__p0Prod0106.control.nextOperations = operations; }, [allowedOperation]);
    await page.locator("#ai-prompt").fill("Widen the invoice description column");
    await page.locator("#ai-send").click();
    await expect(page.locator("#ai-apply-proposal")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#candidate-preview-banner")).toBeVisible();
    const firstProposal = await page.locator("#ai-proposal-card .ai-change-card").getAttribute("data-proposal-id");

    await page.locator("#ai-context-scope-select").selectOption(componentScope);
    await expect(page.locator("#ai-apply-proposal")).toBeVisible();
    await page.locator("#ai-apply-proposal").click();
    await expect(page.locator(".ai-message.system").last()).toContainText("proposal must be previewed again", { timeout: 20_000 });
    await expect(page.locator("#ai-apply-proposal")).toHaveCount(0);
    await expect(page.locator("#candidate-preview-banner")).toBeHidden();
    await expect(page.locator("#ai-context-scope-select")).toHaveValue(componentScope);
    const afterScopeChange = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      return { revision: revision.result.revision, projectHash: revision.result.projectHash, source: document.querySelector("#template-editor").value };
    });
    expect(afterScopeChange).toEqual(baseline);

    await page.locator("#ai-context-scope-select").selectOption("table");
    await page.evaluate((operations) => { window.__p0Prod0106.control.nextOperations = operations; }, [allowedOperation]);
    await page.locator("#ai-prompt").fill("Preview the invoice description width again");
    await page.locator("#ai-send").click();
    await expect(page.locator("#ai-apply-proposal")).toBeVisible({ timeout: 20_000 });
    const secondProposal = await page.locator("#ai-proposal-card .ai-change-card").getAttribute("data-proposal-id");
    expect(secondProposal).not.toBe(firstProposal);
    await page.locator("#ai-apply-proposal").click();
    await expect(page.locator("#revision-label")).toHaveText(`Revision ${baseline.revision + 1}`);
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await expect(page.locator("#ai-apply-proposal")).toHaveCount(0);
    await expect(page.locator(".ai-card-undo")).toBeVisible();
    const afterFreshApply = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      return { revision: revision.result.revision, projectHash: revision.result.projectHash, source: document.querySelector("#template-editor").value };
    });
    expect(afterFreshApply.revision).toBe(baseline.revision + 1);
    expect(afterFreshApply.projectHash).not.toBe(baseline.projectHash);
    expect(afterFreshApply.source).not.toBe(baseline.source);

    await page.evaluate((revision) => { window.__p0Prod0106.control.nextExpectedRevision = revision; }, afterFreshApply.revision);
    await page.evaluate((operations) => { window.__p0Prod0106.control.nextOperations = operations; }, [allowedOperation]);
    await page.locator("#ai-prompt").fill("Prepare another width proposal");
    await page.locator("#ai-send").click();
    await expect(page.locator("#ai-apply-proposal")).toBeVisible({ timeout: 20_000 });
    const replacement = await request.get("/studio-v2/samples/purchase-order-red-v2.html");
    expect(replacement.ok()).toBe(true);
    await page.locator("#import-file").setInputFiles({
      name: "stale-selection-replacement.html", mimeType: "text/html", buffer: await replacement.body()
    });
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await expect(page.locator("#candidate-preview-banner")).toBeHidden();
    await expect(page.locator("#ai-apply-proposal")).toHaveCount(0);
    await expect(page.locator("#ai-context-scope-select")).toHaveValue("all");
    await expect(page.locator("#ai-context-doc-name")).toContainText("Purchase Order", { timeout: 20_000 });

    const control = await page.evaluate(() => window.__p0Prod0106.control);
    expect(control.runs).toBe(3);
    expect(control.actionCalls).toBe(3);
    expect(control.results).toHaveLength(3);
    expect(control.errors).toEqual([]);
    expect(browserErrors).toEqual([]);
    expect(browserDiagnostics.filter((message) => !knownFirefoxAgrunCspDiagnostic(message))).toEqual([]);
    if (browserDiagnostics.some(knownFirefoxAgrunCspDiagnostic)) test.info().annotations.push({
      type: "known-browser-diagnostic",
      description: "Firefox reports the existing AGRUN CSP eval diagnostic; no functional page error was observed."
    });
  });
});
