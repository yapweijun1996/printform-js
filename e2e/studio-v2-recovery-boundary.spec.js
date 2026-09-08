import { expect, test } from "@playwright/test";

test.describe("Studio v2 recovery boundary", () => {
  test("keeps a legacy recovery payload dormant until explicit restrictive restore", async ({ page }) => {
    await page.goto("/studio-v2/");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await page.evaluate(async () => {
      const { createSalesInvoiceProject } = await import("/studio-v2/samples/sales-invoice.js");
      const project = createSalesInvoiceProject();
      project.manifest.title = "RECOVERY-CANARY-20260907";
      localStorage.setItem("printform-studio-v2-recovery", JSON.stringify({
        version: 1, savedAt: Date.now(), fingerprint: "legacy-real", classification: "real", project
      }));
    });
    await page.reload();
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });

    const beforeRestore = await page.evaluate(async () => ({
      summary: await window.PrintFormStudioAgent.execute("get_project_summary"),
      editor: document.querySelector("#manifest-editor").value,
      recoveryVisible: !document.querySelector("#restore-banner").classList.contains("hidden"),
      documentKeys: Object.keys(localStorage).filter((key) => key.startsWith("printform:")),
      stored: localStorage.getItem("printform-studio-v2-recovery")
    }));
    expect(beforeRestore.recoveryVisible).toBe(true);
    expect(beforeRestore.editor).not.toContain("RECOVERY-CANARY-20260907");
    expect(JSON.stringify(beforeRestore.summary)).not.toContain("RECOVERY-CANARY-20260907");
    expect(beforeRestore.stored).toContain("RECOVERY-CANARY-20260907");

    await page.locator("#restore-button").click();
    await expect(page.locator("#data-policy")).toHaveText(/Real data|真实数据/i);
    await expect(page.locator("#manifest-editor")).toHaveValue(/RECOVERY-CANARY-20260907/);
    const afterRestore = await page.evaluate(() => ({
      documentKeys: Object.keys(localStorage).filter((key) => key.startsWith("printform:")),
      stored: localStorage.getItem("printform-studio-v2-recovery")
    }));
    expect(afterRestore.documentKeys).toEqual(beforeRestore.documentKeys);
    expect(afterRestore.stored).toContain("RECOVERY-CANARY-20260907");
  });
});
