import { expect, test } from "@playwright/test";
import { admitPublicGateway, openInspector } from "./studio-v2-helpers.js";

test.describe.configure({ timeout: 180_000 });

test.describe("Studio v2 S09 PROD-04 04-05 project replacement", () => {
  test("drops a late old-document response after importing a new project", async ({ page, request }) => {
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
      return { revision: revision.result.revision, projectHash: revision.result.projectHash, title: document.querySelector("#ai-context-doc-name")?.textContent.trim() || "", source: document.querySelector("#template-editor")?.value || "" };
    });

    await page.evaluate((baselineRevision) => {
      const control = { providerStarted: false, lateCallbacks: [], callbacks: [] };
      const release = new Promise((resolve) => { window.__s09Prod0405Release = resolve; });
      const session = {
        getState: () => ({ cumulativeUsage: { totalTokens: 0 } }),
        runStream(_input, runOptions = {}) {
          return (async function* () {
            control.providerStarted = true;
            control.callbacks.push("started");
            await release;
            control.lateCallbacks.push("old-document-response");
            runOptions.onToken?.("late old-document response");
            control.callbacks.push("late-token");
            yield { type: "phase", detail: { phase: "late", transition: "completed", info: { outcome: "ignored-after-project-replacement" } } };
            control.callbacks.push("late-phase");
            yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: "stale old-document completion" } } } };
            control.callbacks.push("late-completed");
          }());
        }
      };
      window.__s09Prod0405 = control;
      window.Agrun = {
        defineAction: (definition) => definition,
        createInMemorySessionStore: () => ({}),
        createRuntime: () => ({ createSession: async () => session, openSession: async () => session, getAgentSkills: () => [] }),
        openaiBrowserSkill: {},
        geminiBrowserSkill: {}
      };
    }, baseline.revision);

    await page.locator("#ai-prompt").fill("Hold this old-document design request");
    await page.locator("#ai-send").click();
    await expect.poll(() => page.evaluate(() => window.__s09Prod0405?.providerStarted)).toBe(true);

    const replacement = await request.get("/studio-v2/samples/purchase-order-red-v2.html");
    expect(replacement.ok()).toBe(true);
    await page.locator("#import-file").setInputFiles({
      name: "s09-project-replacement.html", mimeType: "text/html", buffer: await replacement.body()
    });
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await expect(page.locator("#ai-context-doc-name")).toContainText("Purchase Order", { timeout: 20_000 });
    await expect(page.locator("#ai-proposal-card")).toBeHidden();
    await expect(page.locator("#ai-send")).toBeEnabled();
    await admitPublicGateway(page);
    const afterSwitch = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      return { revision: revision.result.revision, projectHash: revision.result.projectHash, title: document.querySelector("#ai-context-doc-name")?.textContent.trim() || "", source: document.querySelector("#template-editor")?.value || "" };
    });
    expect(afterSwitch.revision).toBe(0);
    expect(afterSwitch.title).toMatch(/Purchase Order/i);
    expect(afterSwitch.source).not.toBe(baseline.source);

    await page.evaluate(() => window.__s09Prod0405Release?.());
    await expect.poll(() => page.evaluate(() => window.__s09Prod0405?.lateCallbacks.includes("old-document-response"))).toBe(true);
    await expect(page.locator("#ai-proposal-card")).toBeHidden();
    const afterLate = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      return { revision: revision.result.revision, projectHash: revision.result.projectHash, title: document.querySelector("#ai-context-doc-name")?.textContent.trim() || "", source: document.querySelector("#template-editor")?.value || "", control: window.__s09Prod0405 };
    });
    expect(afterLate.revision).toBe(afterSwitch.revision);
    expect(afterLate.projectHash).toBe(afterSwitch.projectHash);
    expect(afterLate.title).toBe(afterSwitch.title);
    expect(afterLate.source).toBe(afterSwitch.source);
    expect(afterLate.control.lateCallbacks).toEqual(["old-document-response"]);
    expect(afterLate.control.callbacks).toContain("late-token");
    expect(afterLate.control.callbacks).not.toContain("late-phase");
    expect(afterLate.control.callbacks).not.toContain("late-completed");
    expect(browserErrors).toEqual([]);
    expect(browserDiagnostics.filter((message) => !knownFirefoxAgrunCspDiagnostic(message))).toEqual([]);
    if (browserDiagnostics.some(knownFirefoxAgrunCspDiagnostic)) test.info().annotations.push({
      type: "known-browser-diagnostic",
      description: "Firefox reports the existing AGRUN CSP eval diagnostic; no functional page error was observed."
    });
  });
});
