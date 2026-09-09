import { expect, test } from "@playwright/test";
import { admitPublicGateway, openEditor, openInspector } from "./studio-v2-helpers.js";

test.describe.configure({ timeout: 180_000 });

async function requestExport(page) {
  return page.evaluate(() => window.PrintFormStudioAgent.execute("request_export"));
}

async function expectTrustedExportBlocked(page) {
  const response = await requestExport(page);
  expect(response.ok).toBe(true);
  expect(response.result.ready).toBe(false);
  expect(response.result.validation.errors.map((item) => item.code)).toContain("LAYOUT_REVIEW_REQUIRED");
  await expect(page.locator("#export-button")).toBeDisabled();
  await expect(page.locator("#export-readiness")).toHaveText(/Blocked/i);
  await expect(page.locator("#ai-context-status")).toHaveText(/Blocked/i);
  return response;
}

test.describe("Studio v2 PROD-03 03-03 review lifecycle", () => {
  test("keeps editing and draft saving available across blocked review states, then accepts only a current pass", async ({ page }) => {
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

    await expectTrustedExportBlocked(page);
    await expect(page.locator("#review-status")).toHaveText("Pending");

    await page.evaluate(() => {
      let runtimeOptions;
      const control = { mode: "blocked", runs: 0, actionCalls: [], downloadClicks: 0 };
      const originalAnchorClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function() {
        if (this.download) control.downloadClicks += 1;
        return originalAnchorClick.call(this);
      };
      const session = {
        getState: () => ({ cumulativeUsage: { totalTokens: 0 } }),
        runStream(input) {
          control.runs += 1;
          control.lastPartCount = input?.parts?.length || 0;
          return (async function* () {
            if (control.mode === "unavailable") {
              throw Object.assign(new Error("Controlled Demo provider unavailable"), { code: "DEMO_SESSION_UNAVAILABLE" });
            }
            const actionName = control.mode === "blocked"
              ? "printform_report_layout_blocked"
              : "printform_complete_current_layout_review";
            const action = runtimeOptions.customActions.find((item) => item.name === actionName);
            if (!action) throw new Error(`${actionName} was not registered`);
            control.actionCalls.push(actionName);
            const args = control.mode === "blocked"
              ? {
                findings: [{ code: "VERTICAL_OVERFLOW", severity: "major", status: "open", message: "Content still overflows the printable page" }],
                summary: "Manual layout work is required before export"
              }
              : { findings: [], summary: "Current layout review passed" };
            await action.execute({}, args);
            yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: "Controlled review terminal action" } } } };
          }());
        }
      };
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
      window.__p0Prod0303 = control;
    });

    await page.locator("#ai-review-layout").click();
    await expect.poll(() => page.evaluate(() => window.__p0Prod0303.runs)).toBe(1);
    await expect(page.locator("#ai-review-card")).toBeVisible();
    await expect(page.locator("#ai-review-findings")).toContainText("VERTICAL_OVERFLOW");
    await expect(page.locator("#ai-status")).toHaveText(/not export-ready|fix.*review/i);
    await expect(page.locator("#ai-review-progress")).toHaveText(/blocking findings|blocking issues|stopped/i);
    await expectTrustedExportBlocked(page);

    await openEditor(page);
    await page.locator("#locale-select").selectOption("zh-CN");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await expect(page.locator("#apply-brand-color-button")).toBeEnabled();
    await expectTrustedExportBlocked(page);
    expect(await page.evaluate(() => Boolean(localStorage.getItem("printform-studio-v2-recovery")))).toBe(true);

    await page.evaluate(() => { window.confirm = () => true; });
    const draftDownload = page.waitForEvent("download");
    await page.locator("#export-menu-button").click();
    await page.locator("#export-untrusted-button").click();
    const draft = await draftDownload;
    expect(draft.suggestedFilename()).toBe("sales-invoice-pilot-untrusted.html");
    await expect(page.locator("#save-state")).toHaveText(/Download started/i);
    expect(await page.evaluate(() => window.__p0Prod0303.downloadClicks)).toBe(1);
    await expectTrustedExportBlocked(page);

    await page.evaluate(() => { window.__p0Prod0303.mode = "unavailable"; });
    await page.locator("#ai-review-layout").click();
    await expect.poll(() => page.evaluate(() => window.__p0Prod0303.runs)).toBe(2);
    await expect(page.locator("#ai-status")).toHaveText(/failed/i);
    await expect(page.locator("#ai-chat-log .ai-message.system").last()).toHaveText(/Demo session|provider/i);
    await expectTrustedExportBlocked(page);
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });

    await page.evaluate(() => { window.__p0Prod0303.mode = "pass"; });
    await page.locator("#ai-review-layout").click();
    await expect.poll(() => page.evaluate(() => window.__p0Prod0303.runs)).toBe(3);
    await expect(page.locator("#ai-status")).toHaveText(/layout review passed|human.*preview.*export/i);
    await expect(page.locator("#review-status")).toHaveText(/Passed|revision/i);
    await expect(page.locator("#quality-summary")).toHaveText(/Pass/i);
    await expect(page.locator("#export-readiness")).toHaveText(/Ready/i);
    await expect(page.locator("#export-button")).toBeEnabled();

    const ready = await requestExport(page);
    expect(ready.ok).toBe(true);
    expect(ready.result.ready).toBe(true);
    expect(ready.result.requiresUserConfirmation).toBe(true);
    expect(ready.result.validation.reviewReceipt.reviewedRevision).toBe(1);
    expect(await page.evaluate(() => window.__p0Prod0303.downloadClicks)).toBe(1);
    expect(await page.evaluate(() => window.__p0Prod0303.actionCalls)).toEqual([
      "printform_report_layout_blocked",
      "printform_complete_current_layout_review"
    ]);
    expect(await page.evaluate(() => window.__p0Prod0303.lastPartCount)).toBeGreaterThan(0);
    expect(browserErrors).toEqual([]);
    expect(browserDiagnostics.filter((message) => !knownFirefoxAgrunCspDiagnostic(message))).toEqual([]);
    if (browserDiagnostics.some(knownFirefoxAgrunCspDiagnostic)) test.info().annotations.push({
      type: "known-browser-diagnostic",
      description: "Firefox reports the existing AGRUN CSP eval diagnostic; no functional page error was observed."
    });
  });
});
