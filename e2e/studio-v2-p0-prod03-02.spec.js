import { expect, test } from "@playwright/test";
import { admitPublicGateway, openEditor, openInspector } from "./studio-v2-helpers.js";

test.describe.configure({ timeout: 120_000 });

test.describe("Studio v2 PROD-03 03-02 renderer failure recovery", () => {
  test("keeps delay, failure and timeout truthful, then recovers through retry", async ({ page, browserName }) => {
    const browserErrors = [];
    const browserDiagnostics = [];
    const knownFirefoxAgrunCspDiagnostic = (message) => browserName === "firefox"
      && /Content-Security-Policy:[\s\S]*blocked a JavaScript eval[\s\S]*agrun\.min\.js/i.test(message);
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") browserDiagnostics.push(message.text()); });

    // Hold the real initial preview so the browser sees the pending state. For
    // later attempts, replace one bridge with an error or a silent document;
    // this exercises the production iframe listener and timeout path without
    // adding a production-only fault switch.
    await page.addInitScript(() => {
      const nativeSetTimeout = window.setTimeout.bind(window);
      const nativeClearTimeout = window.clearTimeout.bind(window);
      const held = new Map();
      let nextHeldId = 1_000_000;
      let holdInitial = true;
      const state = { frameMode: null };
      window.__p0Prod0302 = {
        state,
        heldCount: () => held.size,
        releaseInitialPreview() {
          holdInitial = false;
          const callbacks = [...held.values()];
          held.clear();
          callbacks.forEach((callback) => callback());
        },
        setFrameMode(mode, revision) { state.frameMode = mode ? { mode, revision } : null; }
      };
      window.setTimeout = (callback, delay, ...args) => {
        if (holdInitial && delay === 180 && typeof callback === "function") {
          const id = nextHeldId++;
          held.set(id, () => callback(...args));
          return id;
        }
        return nativeSetTimeout(callback, delay === 30_000 ? 80 : delay, ...args);
      };
      window.clearTimeout = (handle) => {
        if (held.delete(handle)) return;
        nativeClearTimeout(handle);
      };

      const descriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "srcdoc");
      if (!descriptor?.set) return;
      Object.defineProperty(HTMLIFrameElement.prototype, "srcdoc", {
        configurable: descriptor.configurable,
        enumerable: descriptor.enumerable,
        get: descriptor.get,
        set(value) {
          let next = String(value);
          const bridge = next.match(/<script nonce="([^"]+)"[\s\S]*?type: "rendered", revision: ([^,]+), token: ([^,]+), payload:/);
          const mode = bridge && state.frameMode?.revision !== undefined
            && String(state.frameMode.revision) === bridge[2] ? state.frameMode.mode : null;
          if (bridge && mode === "fail") {
            const [, nonce, revision, token] = bridge;
            next = `<script nonce="${nonce}">parent.postMessage({source:"printform-studio-v2-preview",type:"error",revision:${revision},token:${token},payload:{message:"controlled preview failure"}},"*");<\/script>`;
          } else if (bridge && mode === "timeout") {
            next = "<!doctype html><title>controlled preview timeout</title>";
          }
          return descriptor.set.call(this, next);
        }
      });
    });

    await page.goto("/studio-v2/?sample=sales-invoice");
    await expect(page).toHaveTitle(/PrintForm Studio v2/);
    await expect.poll(() => page.evaluate(() => window.__p0Prod0302.heldCount())).toBeGreaterThan(0);
    await openInspector(page);
    await page.locator("#ai-designer-tab").click();
    await admitPublicGateway(page);

    await expect(page.locator("#render-status")).toHaveText("Rendering");
    await expect(page.locator("#retry-preview-button")).toBeHidden();
    await page.evaluate(() => window.__p0Prod0302.releaseInitialPreview());
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });

    await openEditor(page);
    const failedRevision = await page.evaluate(async () => (await window.PrintFormStudioAgent.execute("get_revision")).result.revision + 1);
    await page.evaluate((revision) => window.__p0Prod0302.setFrameMode("fail", revision), failedRevision);
    await page.locator("#locale-select").selectOption("zh-CN");
    await expect(page.locator("#render-status")).toHaveText("Preview failed", { timeout: 20_000 });
    await expect(page.locator("#retry-preview-button")).toBeVisible();
    const failed = await page.evaluate(async () => {
      const readiness = await window.PrintFormStudioAgent.execute("request_export");
      return {
        revision: (await window.PrintFormStudioAgent.execute("get_revision")).result.revision,
        readiness: readiness.result,
        quality: document.querySelector("#quality-summary").textContent,
        contextStatus: document.querySelector("#ai-context-status").textContent,
        exportChip: document.querySelector("#export-readiness").textContent,
        exportDisabled: document.querySelector("#export-button").disabled,
        retryVisible: !document.querySelector("#retry-preview-button").classList.contains("hidden")
      };
    });
    expect(failed.readiness.ready).toBe(false);
    expect(failed.readiness.validation.errors.map((item) => item.code)).toEqual(expect.arrayContaining([
      "PREVIEW_REQUIRED", "LAYOUT_REVIEW_REQUIRED"
    ]));
    expect(failed.quality).toMatch(/Blocked/);
    expect(failed.contextStatus).toBe("Blocked");
    expect(failed.exportChip).toContain("Blocked");
    expect(failed.exportDisabled).toBe(true);
    expect(failed.retryVisible).toBe(true);

    await page.evaluate(() => window.__p0Prod0302.setFrameMode(null));
    await page.locator("#retry-preview-button").click();
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await expect(page.locator("#retry-preview-button")).toBeHidden();

    const timeoutRevision = await page.evaluate(async () => (await window.PrintFormStudioAgent.execute("get_revision")).result.revision + 1);
    await page.evaluate((revision) => window.__p0Prod0302.setFrameMode("timeout", revision), timeoutRevision);
    await page.locator("#locale-select").selectOption("ms-MY");
    await expect(page.locator("#render-status")).toHaveText("Preview failed", { timeout: 20_000 });
    await expect(page.locator("#retry-preview-button")).toBeVisible();
    const timedOut = await page.evaluate(async () => {
      const readiness = await window.PrintFormStudioAgent.execute("request_export");
      return {
        readiness: readiness.result,
        quality: document.querySelector("#quality-summary").textContent,
        contextStatus: document.querySelector("#ai-context-status").textContent,
        exportDisabled: document.querySelector("#export-button").disabled
      };
    });
    expect(timedOut.readiness.ready).toBe(false);
    expect(timedOut.readiness.validation.errors.map((item) => item.code)).toContain("PREVIEW_REQUIRED");
    expect(timedOut.quality).toMatch(/Blocked/);
    expect(timedOut.contextStatus).toBe("Blocked");
    expect(timedOut.exportDisabled).toBe(true);

    await page.evaluate(() => window.__p0Prod0302.setFrameMode(null));
    await page.locator("#retry-preview-button").click();
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await expect(page.locator("#retry-preview-button")).toBeHidden();
    expect(browserErrors).toEqual([]);
    expect(browserDiagnostics.filter((message) => !knownFirefoxAgrunCspDiagnostic(message))).toEqual([]);
    if (browserDiagnostics.some(knownFirefoxAgrunCspDiagnostic)) test.info().annotations.push({
      type: "known-browser-diagnostic",
      description: "Firefox reports the existing AGRUN CSP eval diagnostic; no functional page error was observed."
    });
  });
});
