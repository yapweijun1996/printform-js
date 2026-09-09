import { expect, test } from "@playwright/test";
import { admitPublicGateway, openEditor } from "./studio-v2-helpers.js";
import { readClientStorage } from "./studio-v2-storage-inspection.js";

const CANARY = "S10-RECOVERY-CANARY";

test.describe("Studio v2 S10 PROD-08 08-02 recovery round-trip", () => {
  test("keeps the recovery copy dormant until explicit Unknown restore", async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    const knownFirefoxAgrunCspDiagnostic = (message) => test.info().project.name === "firefox"
      && /Content-Security-Policy:[\s\S]*blocked a JavaScript eval[\s\S]*agrun\.min\.js/i.test(message);
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });

    await page.goto("/studio-v2/?sample=sales-invoice");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await openEditor(page);

    const manifest = JSON.parse(await page.locator("#manifest-editor").inputValue());
    manifest.title = CANARY;
    await page.locator("#manifest-editor").fill(JSON.stringify(manifest, null, 2));
    await page.locator("#apply-source-button").click();
    await page.locator("#source-diff-apply").click();
    await expect(page.locator("#revision-label")).toHaveText(/Revision 1|版本 1/i);
    await expect(page.locator("#save-state")).toHaveText(/Unsaved changes|未保存更改/i);
    await expect.poll(() => page.evaluate(() => localStorage.getItem("printform-studio-v2-recovery"))).toContain(CANARY);
    const savedRecovery = await page.evaluate(() => localStorage.getItem("printform-studio-v2-recovery"));

    await page.reload();
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await expect(page.locator("#restore-banner")).not.toHaveClass(/hidden/);
    await openEditor(page);
    expect(await page.locator("#manifest-editor").inputValue()).not.toContain(CANARY);
    expect(await page.evaluate(() => localStorage.getItem("printform-studio-v2-recovery"))).toBe(savedRecovery);

    await page.locator("#restore-button").click();
    await expect(page.locator("#restore-banner")).toHaveClass(/hidden/);
    await expect(page.locator("#data-policy")).toHaveText(/Unknown data|未知数据/i);
    await expect(page.locator("#manifest-editor")).toHaveValue(new RegExp(CANARY));
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await admitPublicGateway(page);
    const restored = await page.evaluate(async () => ({
      revision: (await window.PrintFormStudioAgent.execute("get_revision")).result,
      summary: await window.PrintFormStudioAgent.execute("get_project_summary"),
      recovery: localStorage.getItem("printform-studio-v2-recovery")
    }));
    const restoredStorage = await readClientStorage(page);
    expect(restored.revision.revision).toBe(0);
    expect(restored.summary.result.revision).toBe(0);
    expect(restored.recovery).toBe(savedRecovery);
    expect(restoredStorage.local["printform-studio-v2-recovery"]).toBe(savedRecovery);
    expect(Object.keys(restoredStorage.local).filter((key) => key.includes(":durable:")).length).toBe(0);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors.filter((message) => !knownFirefoxAgrunCspDiagnostic(message))).toEqual([]);
    if (consoleErrors.some(knownFirefoxAgrunCspDiagnostic)) test.info().annotations.push({
      type: "known-browser-diagnostic",
      description: "Firefox reports the existing AGRUN CSP eval diagnostic; no functional page error was observed."
    });
  });
});
