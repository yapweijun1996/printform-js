import { expect, test } from "@playwright/test";
import { admitPublicGateway, openInspector } from "./studio-v2-helpers.js";

test.describe.configure({ timeout: 120_000 });

test.describe("Studio v2 PROD-03 03-01 initial readiness", () => {
  test("does not project static validity as Printable before a current browser report", async ({ page, browserName }) => {
    const browserErrors = [];
    const browserDiagnostics = [];
    const knownFirefoxAgrunCspDiagnostic = (message) => browserName === "firefox"
      && /Content-Security-Policy:[\s\S]*blocked a JavaScript eval[\s\S]*agrun\.min\.js/i.test(message);
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") browserDiagnostics.push(message.text()); });

    // Hold the app's initial 180 ms preview schedule so the browser observes
    // the real CommandBus state while renderReport is still null. This keeps
    // the case deterministic without adding a production-only test hook.
    await page.addInitScript(() => {
      const nativeSetTimeout = window.setTimeout.bind(window);
      const nativeClearTimeout = window.clearTimeout.bind(window);
      const held = [];
      const marker = 301;
      window.__p0Prod0301 = {
        releaseInitialPreview() {
          const callbacks = held.splice(0);
          callbacks.forEach((callback) => callback());
        },
        heldCount: () => held.length,
      };
      window.setTimeout = (callback, delay, ...args) => {
        if (delay === 180 && typeof callback === "function") {
          held.push(() => callback(...args));
          return marker;
        }
        return nativeSetTimeout(callback, delay, ...args);
      };
      window.clearTimeout = (handle) => {
        if (handle !== marker) nativeClearTimeout(handle);
      };
    });

    await page.goto("/studio-v2/?sample=sales-invoice");
    await expect(page).toHaveTitle(/PrintForm Studio v2/);
    await expect.poll(() => page.evaluate(() => window.__p0Prod0301.heldCount())).toBeGreaterThan(0);
    await openInspector(page);
    await page.locator("#ai-designer-tab").click();
    await admitPublicGateway(page);

    const initial = await page.evaluate(async () => {
      const summary = await window.PrintFormStudioAgent.execute("get_project_summary");
      const readiness = await window.PrintFormStudioAgent.execute("request_export");
      return {
        summary: summary.result,
        readiness: readiness.result,
        renderStatus: document.querySelector("#render-status").textContent,
        quality: document.querySelector("#quality-summary").textContent,
        issues: [...document.querySelectorAll("#issue-list li")].map((node) => node.textContent),
        contextStatus: document.querySelector("#ai-context-status").textContent,
        contextState: document.querySelector("#ai-context-state").textContent,
        exportChip: document.querySelector("#export-readiness").textContent,
        exportDisabled: document.querySelector("#export-button").disabled,
        reviewStatus: document.querySelector("#review-status").textContent,
      };
    });

    expect(initial.summary.revision).toBe(0);
    expect(initial.summary.validation.errors).toEqual([]);
    expect(initial.readiness.ready).toBe(false);
    expect(initial.readiness.validation.errors.map((item) => item.code)).toEqual(expect.arrayContaining([
      "PREVIEW_REQUIRED", "LAYOUT_REVIEW_REQUIRED"
    ]));
    expect(initial.renderStatus).toBe("Rendering");
    expect(initial.quality).toMatch(/Blocked/);
    expect(initial.issues.join(" ")).toContain("PREVIEW_REQUIRED");
    expect(initial.contextState).toBe("Committed");
    expect(initial.contextStatus).toBe("Blocked");
    expect(initial.exportChip).toContain("Blocked");
    expect(initial.exportDisabled).toBe(true);
    expect(initial.reviewStatus).toBe("Pending");
    expect(initial.renderStatus).not.toBe("Printable");

    await page.evaluate(() => window.__p0Prod0301.releaseInitialPreview());
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    const afterRender = await page.evaluate(async () => {
      const readiness = await window.PrintFormStudioAgent.execute("request_export");
      return {
        readiness: readiness.result,
        quality: document.querySelector("#quality-summary").textContent,
        contextStatus: document.querySelector("#ai-context-status").textContent,
        exportDisabled: document.querySelector("#export-button").disabled,
      };
    });
    expect(afterRender.readiness.ready).toBe(false);
    expect(afterRender.readiness.validation.errors.map((item) => item.code)).not.toContain("PREVIEW_REQUIRED");
    expect(afterRender.readiness.validation.errors.map((item) => item.code)).toContain("LAYOUT_REVIEW_REQUIRED");
    expect(afterRender.quality).toMatch(/Blocked/);
    expect(afterRender.contextStatus).toBe("Blocked");
    expect(afterRender.exportDisabled).toBe(true);
    expect(browserErrors).toEqual([]);
    expect(browserDiagnostics.filter((message) => !knownFirefoxAgrunCspDiagnostic(message))).toEqual([]);
    if (browserDiagnostics.some(knownFirefoxAgrunCspDiagnostic)) test.info().annotations.push({
      type: "known-browser-diagnostic",
      description: "Firefox reports the existing AGRUN CSP eval diagnostic; no functional page error was observed."
    });
  });
});
