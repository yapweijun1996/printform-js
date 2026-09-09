import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { admitPublicGateway, openEditor } from "./studio-v2-helpers.js";

const importedFixture = fs.readFileSync(
  path.resolve(process.cwd(), "site-dist/studio-v2/samples/purchase-order-red-v2.html"),
  "utf8"
).replaceAll("Purchase Order", "S10-IMPORT-CANARY");

test.describe("Studio v2 S10 PROD-08 08-01 overwrite/import/switch guard", () => {
  test("preserves a dirty draft until replacement is explicitly confirmed", async ({ page }) => {
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

    const manifest = JSON.parse(await page.locator("#manifest-editor").inputValue());
    manifest.title = "S10-DIRTY-CANARY";
    await page.locator("#manifest-editor").fill(JSON.stringify(manifest, null, 2));
    await page.locator("#apply-source-button").click();
    await page.locator("#source-diff-apply").click();
    await expect(page.locator("#revision-label")).toHaveText(/Revision 1|版本 1/i);
    await expect(page.locator("#save-state")).toHaveText(/Unsaved changes|未保存更改/i);
    const before = await page.evaluate(async () => ({
      summary: await window.PrintFormStudioAgent.execute("get_project_summary"),
      revision: (await window.PrintFormStudioAgent.execute("get_revision")).result,
      manifest: document.querySelector("#manifest-editor").value,
      source: document.querySelector("#template-editor").value,
      saveState: document.querySelector("#save-state").textContent,
      recovery: localStorage.getItem("printform-studio-v2-recovery")
    }));
    expect(before.revision.revision).toBe(1);
    expect(before.recovery).not.toBeNull();

    let samplePrompt = "";
    page.once("dialog", async (dialog) => { samplePrompt = dialog.message(); await dialog.dismiss(); });
    await page.locator("#document-select").selectOption("purchase-order-red");
    expect(samplePrompt).toMatch(/discard|舍弃|b.mbuang|破棄|loại bỏ/i);
    await expect(page.locator("#document-select")).toHaveValue("sales-invoice");
    const afterSampleCancel = await page.evaluate(async () => ({
      revision: (await window.PrintFormStudioAgent.execute("get_revision")).result,
      manifest: document.querySelector("#manifest-editor").value,
      source: document.querySelector("#template-editor").value,
      saveState: document.querySelector("#save-state").textContent,
      recovery: localStorage.getItem("printform-studio-v2-recovery")
    }));
    expect(afterSampleCancel).toEqual({ revision: before.revision, manifest: before.manifest, source: before.source, saveState: before.saveState, recovery: before.recovery });

    let importPrompt = "";
    page.once("dialog", async (dialog) => { importPrompt = dialog.message(); await dialog.dismiss(); });
    await page.locator("#import-file").setInputFiles({ name: "s10-import.html", mimeType: "text/html", buffer: Buffer.from(importedFixture) });
    expect(importPrompt).toMatch(/discard|舍弃|b.mbuang|破棄|loại bỏ/i);
    await expect(page.locator("#document-select")).toHaveValue("sales-invoice");
    expect(await page.locator("#manifest-editor").inputValue()).toBe(before.manifest);
    expect(await page.locator("#save-state").textContent()).toBe(before.saveState);
    expect(await page.evaluate(() => document.querySelector("#import-file").value)).toBe("");
    expect(await page.evaluate(() => localStorage.getItem("printform-studio-v2-recovery"))).toBe(before.recovery);

    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("#import-file").setInputFiles({ name: "s10-import.html", mimeType: "text/html", buffer: Buffer.from(importedFixture) });
    await expect(page.locator("#data-policy")).toHaveText(/Unknown data|未知数据/i);
    await expect(page.locator("#manifest-editor")).toHaveValue(/S10-IMPORT-CANARY/);
    await expect(page.locator("#save-state")).toHaveText(/Saved|已保存/i);
    await admitPublicGateway(page);
    expect((await page.evaluate(async () => (await window.PrintFormStudioAgent.execute("get_revision")).result)).revision).toBe(0);
    expect(await page.locator("#document-select").inputValue()).toBe("");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors.filter((message) => !knownFirefoxAgrunCspDiagnostic(message))).toEqual([]);
    if (consoleErrors.some(knownFirefoxAgrunCspDiagnostic)) test.info().annotations.push({
      type: "known-browser-diagnostic",
      description: "Firefox reports the existing AGRUN CSP eval diagnostic; no functional page error was observed."
    });
  });
});
