import { expect, test } from "@playwright/test";
import { admitPublicGateway, openEditor } from "./studio-v2-helpers.js";

const RECOVERY_KEY = "printform-studio-v2-recovery";
const EXPIRED_CANARY = "S10-EXPIRED-RECOVERY-CANARY";

test.describe("Studio v2 S10 PROD-08 08-06 recovery/import fallback", () => {
  test("fails closed for corrupt or expired recovery and rejected import input", async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    const knownFirefoxAgrunCspDiagnostic = (message) => test.info().project.name === "firefox"
      && /Content-Security-Policy:[\s\S]*blocked a JavaScript eval[\s\S]*agrun\.min\.js/i.test(message);
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });

    await page.goto("/studio-v2/?sample=sales-invoice");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await page.evaluate((key) => localStorage.setItem(key, "{not valid recovery json"), RECOVERY_KEY);

    await page.reload();
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await openEditor(page);
    const corrupt = await page.evaluate((key) => ({
      recoveryVisible: !document.querySelector("#restore-banner").classList.contains("hidden"),
      manifest: document.querySelector("#manifest-editor").value,
      stored: localStorage.getItem(key)
    }), RECOVERY_KEY);
    expect(corrupt.recoveryVisible).toBe(false);
    expect(corrupt.manifest).toContain("Sales Invoice");
    expect(corrupt.stored).toBe("{not valid recovery json");

    await page.evaluate(async ({ canary, key }) => {
      const { createSalesInvoiceProject } = await import("/studio-v2/samples/sales-invoice.js");
      const project = createSalesInvoiceProject();
      project.manifest.title = canary;
      localStorage.setItem(key, JSON.stringify({
        version: 1, savedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
        fingerprint: "expired-synthetic", classification: "synthetic", project
      }));
    }, { canary: EXPIRED_CANARY, key: RECOVERY_KEY });

    await page.reload();
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await openEditor(page);
    const expired = await page.evaluate((key) => ({
      recoveryVisible: !document.querySelector("#restore-banner").classList.contains("hidden"),
      manifest: document.querySelector("#manifest-editor").value,
      stored: localStorage.getItem(key)
    }), RECOVERY_KEY);
    expect(expired.recoveryVisible).toBe(false);
    expect(expired.manifest).not.toContain(EXPIRED_CANARY);
    expect(expired.stored).toContain(EXPIRED_CANARY);

    await page.evaluate((key) => localStorage.removeItem(key), RECOVERY_KEY);
    await admitPublicGateway(page);
    const beforeImport = await page.evaluate(() => ({
      manifest: document.querySelector("#manifest-editor").value,
      saveState: document.querySelector("#save-state").textContent,
      policy: document.querySelector("#data-policy").textContent,
      revision: document.querySelector("#revision-label").textContent
    }));
    await page.locator("#import-file").setInputFiles({
      name: "rejected-invalid.html", mimeType: "text/html",
      buffer: Buffer.from("<!doctype html><html><body>not a Studio project</body></html>")
    });
    await expect(page.locator("#toast")).toContainText(/Import rejected/i);
    const afterImport = await page.evaluate(() => ({
      manifest: document.querySelector("#manifest-editor").value,
      saveState: document.querySelector("#save-state").textContent,
      policy: document.querySelector("#data-policy").textContent,
      revision: document.querySelector("#revision-label").textContent,
      recovery: localStorage.getItem("printform-studio-v2-recovery")
    }));
    expect(afterImport).toEqual({ ...beforeImport, recovery: null });
    const revision = await page.evaluate(() => window.PrintFormStudioAgent.execute("get_revision"));
    expect(revision.result.revision).toBe(0);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors.filter((message) => !knownFirefoxAgrunCspDiagnostic(message))).toEqual([]);
    if (consoleErrors.some(knownFirefoxAgrunCspDiagnostic)) test.info().annotations.push({
      type: "known-browser-diagnostic",
      description: "Firefox reports the existing AGRUN CSP eval diagnostic; no functional page error was observed."
    });
  });
});
