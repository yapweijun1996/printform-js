import { expect, test } from "@playwright/test";
import { openEditor } from "./studio-v2-helpers.js";
import { readClientStorage } from "./studio-v2-storage-inspection.js";

const CANARY = "S10-QUOTA-CANARY";

test.describe("Studio v2 S10 PROD-08 08-03 storage/privacy boundary", () => {
  test("keeps quota failure non-throwing and avoids new Real/Unknown persistence", async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    const knownFirefoxAgrunCspDiagnostic = (message) => test.info().project.name === "firefox"
      && /Content-Security-Policy:[\s\S]*blocked a JavaScript eval[\s\S]*agrun\.min\.js/i.test(message);
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });

    await page.goto("/studio-v2/?sample=sales-invoice");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await openEditor(page);
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });

    const quota = await page.evaluate(async (canary) => {
      const { createSalesInvoiceProject } = await import("/studio-v2/samples/sales-invoice.js");
      const { classifySyntheticDocument } = await import("/studio-v2/core/data-policy.js");
      const { saveRecoveryDraft } = await import("/studio-v2/ui/draft-cache.js");
      const originalSetItem = Storage.prototype.setItem;
      let result;
      let threw = false;
      Storage.prototype.setItem = function() { throw new DOMException(canary, "QuotaExceededError"); };
      try {
        result = saveRecoveryDraft(createSalesInvoiceProject(), "quota-fingerprint", {
          policy: classifySyntheticDocument("sales-invoice-pilot")
        });
      } catch {
        threw = true;
      } finally {
        Storage.prototype.setItem = originalSetItem;
      }
      return { result, threw };
    }, CANARY);
    expect(quota).toEqual({ result: false, threw: false });

    // The initial page can register the Service Worker after the first paint.
    // Wait for its install/cache work before taking the privacy baseline so
    // app-shell warming is not mistaken for a Real/Unknown persistence write.
    await page.evaluate(async () => navigator.serviceWorker?.ready);
    const beforeReal = await readClientStorage(page);
    const directPolicyResults = await page.evaluate(async () => {
      const { classifyImportedDocument, classifyRealDocument } = await import("/studio-v2/core/data-policy.js");
      const { saveRecoveryDraft } = await import("/studio-v2/ui/draft-cache.js");
      const project = { manifest: { documentId: "s10-restrictive" }, body: "S10-RESTRICTIVE-CANARY" };
      return {
        unknown: saveRecoveryDraft(project, "unknown", { policy: classifyImportedDocument("s10-restrictive") }),
        real: saveRecoveryDraft(project, "real", { policy: classifyRealDocument("s10-restrictive") })
      };
    });
    expect(directPolicyResults).toEqual({ unknown: false, real: false });

    await page.locator("label.privacy-toggle").click();
    await expect(page.locator("#data-policy")).toHaveText(/Real data|真实数据/i);
    const currentLocale = await page.locator("#locale-select").inputValue();
    await page.locator("#locale-select").selectOption(currentLocale === "en-MY" ? "zh-CN" : "en-MY");
    await expect(page.locator("#save-state")).toHaveText(/Unsaved changes|未保存更改/i);
    expect(await readClientStorage(page)).toEqual(beforeReal);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors.filter((message) => !knownFirefoxAgrunCspDiagnostic(message))).toEqual([]);
    if (consoleErrors.some(knownFirefoxAgrunCspDiagnostic)) test.info().annotations.push({
      type: "known-browser-diagnostic",
      description: "Firefox reports the existing AGRUN CSP eval diagnostic; no functional page error was observed."
    });
  });
});
