import { expect, test } from "@playwright/test";
import { admitPublicGateway, openEditor, openInspector } from "./studio-v2-helpers.js";

test.describe.configure({ timeout: 180_000 });

async function run(page, name, input = {}) {
  return page.evaluate(({ name: command, input: payload }) => window.PrintFormStudioAgent.execute(command, payload), { name, input });
}

async function expectBlockedForRevision(page, revision) {
  const result = await run(page, "request_export");
  expect(result.ok).toBe(true);
  expect(result.result.revision).toBe(revision);
  expect(result.result.ready).toBe(false);
  expect(result.result.validation.errors.map((item) => item.code)).toContain("LAYOUT_REVIEW_REQUIRED");
  expect(result.result.validation.reviewReceipt || null).toBeNull();
  await expect(page.locator("#export-readiness")).toHaveText(/Blocked/i);
  await expect(page.locator("#export-button")).toBeDisabled();
  await expect(page.locator("#review-status")).toHaveText("Pending");
  return result;
}

test.describe("Studio v2 PROD-03 03-04 invalidated evidence", () => {
  test("requires a fresh review after edit and history navigation", async ({ page }) => {
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

    await page.evaluate(() => {
      let runtimeOptions;
      const control = { runs: 0, actionCalls: [] };
      const session = {
        getState: () => ({ cumulativeUsage: { totalTokens: 0 } }),
        runStream(input) {
          control.runs += 1;
          control.lastPartCount = input?.parts?.length || 0;
          return (async function* () {
            const action = runtimeOptions.customActions.find((item) => item.name === "printform_complete_current_layout_review");
            if (!action) throw new Error("printform_complete_current_layout_review was not registered");
            control.actionCalls.push(action.name);
            await action.execute({}, { findings: [], summary: "Current committed layout review passed" });
            yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: "Controlled current review" } } } };
          }());
        }
      };
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
      window.__p0Prod0304 = control;
    });

    await page.locator("#ai-review-layout").click();
    await expect.poll(() => page.evaluate(() => window.__p0Prod0304.runs)).toBe(1);
    await expect(page.locator("#export-readiness")).toHaveText(/Ready/i);
    await expect(page.locator("#export-button")).toBeEnabled();
    const initial = await run(page, "request_export");
    expect(initial.result.revision).toBe(0);
    expect(initial.result.ready).toBe(true);
    expect(initial.result.validation.reviewReceipt.reviewedRevision).toBe(0);

    await openEditor(page);
    await page.locator("#locale-select").selectOption("zh-CN");
    await expect(page.locator("#revision-label")).toHaveText("Revision 1");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await expectBlockedForRevision(page, 1);
    const afterEdit = await run(page, "get_layout_review_status");
    expect(afterEdit.result.revision).toBe(1);
    expect(afterEdit.result.review.status).toBe("required");

    await page.locator("#ai-review-layout").click();
    await expect.poll(() => page.evaluate(() => window.__p0Prod0304.runs)).toBe(2);
    await expect(page.locator("#export-readiness")).toHaveText(/Ready/i);
    expect((await run(page, "request_export")).result.validation.reviewReceipt.reviewedRevision).toBe(1);

    await page.locator("#ai-undo-revision").click();
    await expect(page.locator("#revision-label")).toHaveText("Revision 2");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await expectBlockedForRevision(page, 2);

    await page.locator("#ai-redo-revision").click();
    await expect(page.locator("#revision-label")).toHaveText("Revision 3");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await expectBlockedForRevision(page, 3);

    expect(await page.evaluate(() => window.__p0Prod0304.actionCalls)).toEqual([
      "printform_complete_current_layout_review",
      "printform_complete_current_layout_review"
    ]);
    expect(await page.evaluate(() => window.__p0Prod0304.lastPartCount)).toBeGreaterThan(0);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors.filter((message) => !knownFirefoxAgrunCspDiagnostic(message))).toEqual([]);
    if (consoleErrors.some(knownFirefoxAgrunCspDiagnostic)) test.info().annotations.push({
      type: "known-browser-diagnostic",
      description: "Firefox reports the existing AGRUN CSP eval diagnostic; no functional page error was observed."
    });
  });
});
