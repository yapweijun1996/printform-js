import { expect, test } from "@playwright/test";
import { admitPublicGateway, openEditor, passLayoutReview } from "./studio-v2-helpers.js";

test.describe.configure({ timeout: 180_000 });

async function requestExport(page) {
  return page.evaluate(() => window.PrintFormStudioAgent.execute("request_export"));
}

async function setSaveMode(page, mode) {
  await page.evaluate((nextMode) => {
    const control = window.__p0Prod0307;
    Object.assign(control, {
      mode: nextMode,
      phase: null,
      confirmCalls: 0,
      pickerCalls: 0,
      opens: 0,
      writes: 0,
      closes: 0,
      aborts: 0,
      committed: false,
      html: null,
      release: null
    });
  }, mode);
}

function attestationFrom(html) {
  const match = html.match(/<script id="pf-attestation" type="application\/json">([\s\S]*?)<\/script>/);
  expect(match).not.toBeNull();
  return JSON.parse(match[1]);
}

test.describe("Studio v2 PROD-03 03-07 save independence", () => {
  test("reports only confirmed writes as saved and preserves newer edits", async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    const knownFirefoxAgrunCspDiagnostic = (message) => test.info().project.name === "firefox"
      && /Content-Security-Policy:[\s\S]*blocked a JavaScript eval[\s\S]*agrun\.min\.js/i.test(message);
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });

    await page.goto("/studio-v2/?sample=sales-invoice");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await openEditor(page);
    await admitPublicGateway(page);
    const reviewed = await passLayoutReview(page);
    expect(reviewed.ok).toBe(true);
    expect((await requestExport(page)).result).toMatchObject({ ready: true, revision: 0, requiresUserConfirmation: true });
    await expect(page.locator("#export-button")).toBeEnabled();

    await page.evaluate(() => {
      const control = window.__p0Prod0307 = {
        mode: "cancel", phase: null, confirmCalls: 0, pickerCalls: 0,
        opens: 0, writes: 0, closes: 0, aborts: 0, committed: false, html: null, release: null,
        downloadClicks: 0
      };
      const originalAnchorClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function() {
        if (this.download) control.downloadClicks += 1;
        return originalAnchorClick.call(this);
      };
      window.confirm = () => {
        control.confirmCalls += 1;
        return !(control.mode === "download" && control.confirmCalls === 2);
      };
      Object.defineProperty(window, "showSaveFilePicker", {
        configurable: true,
        writable: true,
        value: async () => {
          control.pickerCalls += 1;
          control.phase = "picker";
          if (control.mode === "cancel") throw new DOMException("Synthetic picker cancellation", "AbortError");
          return {
            createWritable: async () => {
              control.opens += 1;
              return {
                async write(html) {
                  control.writes += 1;
                  control.html = html;
                  if (control.mode === "fail") throw new Error("Synthetic file write failure");
                },
                async close() {
                  control.closes += 1;
                  if (control.mode === "hold") {
                    control.phase = "close";
                    await new Promise((resolve) => { control.release = resolve; });
                  }
                  control.committed = true;
                },
                async abort() { control.aborts += 1; }
              };
            }
          };
        }
      });
    });

    await setSaveMode(page, "cancel");
    await page.locator("#export-button").click();
    await expect(page.locator("#save-state")).toHaveText("Save cancelled");
    expect(await page.evaluate(() => window.__p0Prod0307)).toMatchObject({ pickerCalls: 1, opens: 0, writes: 0, closes: 0, aborts: 0, committed: false, downloadClicks: 0 });

    await setSaveMode(page, "fail");
    await page.locator("#export-button").click();
    await expect(page.locator("#save-state")).toHaveText("Save failed");
    expect(await page.evaluate(() => window.__p0Prod0307)).toMatchObject({ pickerCalls: 1, opens: 1, writes: 1, closes: 0, aborts: 1, committed: false, downloadClicks: 0 });

    await setSaveMode(page, "success");
    await page.locator("#export-button").click();
    await expect(page.locator("#save-state")).toHaveText("Saved");
    const successful = await page.evaluate(() => window.__p0Prod0307);
    expect(successful).toMatchObject({ pickerCalls: 1, opens: 1, writes: 1, closes: 1, aborts: 0, committed: true, downloadClicks: 0 });
    expect(attestationFrom(successful.html).evidence).toMatchObject({ revision: 0, validation: { status: "PASS" } });
    expect((await requestExport(page)).result.ready).toBe(true);

    await setSaveMode(page, "download");
    const downloadEvent = page.waitForEvent("download");
    await page.locator("#export-button").click();
    const download = await downloadEvent;
    await expect(page.locator("#save-state")).toHaveText(/Download started/i);
    expect(download.suggestedFilename()).toBe("sales-invoice-pilot.html");
    expect(await page.evaluate(() => window.__p0Prod0307)).toMatchObject({ pickerCalls: 0, opens: 0, writes: 0, closes: 0, aborts: 0, committed: false, downloadClicks: 1 });

    await setSaveMode(page, "hold");
    await page.locator("#export-button").click();
    await expect.poll(() => page.evaluate(() => window.__p0Prod0307.phase)).toBe("close");
    await expect(page.locator("#save-state")).toHaveText(/Saving/i);
    await page.locator("#locale-select").selectOption("zh-CN");
    await expect.poll(async () => (await requestExport(page)).result.revision).toBe(1);
    await expect(page.locator("#save-state")).toHaveText(/Saving/i);
    expect((await requestExport(page)).result.ready).toBe(false);
    await page.evaluate(() => window.__p0Prod0307.release());
    await expect(page.locator("#save-state")).toHaveText("Unsaved changes");
    const edited = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      const readiness = await window.PrintFormStudioAgent.execute("request_export");
      return { control: window.__p0Prod0307, revision: revision.result, readiness };
    });
    expect(edited.control).toMatchObject({ pickerCalls: 1, opens: 1, writes: 1, closes: 1, aborts: 0, committed: true, downloadClicks: 1 });
    expect(attestationFrom(edited.control.html).evidence.revision).toBe(0);
    expect(edited.revision.revision).toBe(1);
    expect(edited.readiness.result.ready).toBe(false);
    expect(edited.readiness.result.validation.errors.map((item) => item.code)).toContain("LAYOUT_REVIEW_REQUIRED");
    expect(pageErrors).toEqual([]);
    expect(consoleErrors.filter((message) => !knownFirefoxAgrunCspDiagnostic(message))).toEqual([]);
    if (consoleErrors.some(knownFirefoxAgrunCspDiagnostic)) test.info().annotations.push({
      type: "known-browser-diagnostic",
      description: "Firefox reports the existing AGRUN CSP eval diagnostic; no functional page error was observed."
    });
  });
});
