import { expect, test } from "@playwright/test";
import { openEditor, openInspector } from "./studio-v2-helpers.js";

test.describe("Studio v2 scope ownership", () => {
  test("keeps scope across policy changes and resets it for a replaced project", async ({ page, request }) => {
    const fixture = await request.get("/studio-v2/samples/purchase-order-red-v2.html");
    expect(fixture.ok()).toBe(true);
    await page.goto("/studio-v2/");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await openEditor(page);
    await openInspector(page);

    const tableValue = await page.locator("#ai-context-scope-select option").evaluateAll((options) => options
      .map((option) => option.value)
      .find((value) => value === "table" || value.startsWith("table:")));
    expect(tableValue).toBeTruthy();
    await page.locator("#ai-context-scope-select").selectOption(tableValue);
    await expect(page.locator("#ai-context-scope-select")).toHaveValue(tableValue);

    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("label.privacy-toggle").click();
    await expect(page.locator("#data-policy")).toHaveText(/Real data|真实数据/i);
    await expect(page.locator("#ai-context-scope-select")).toHaveValue(tableValue);

    await page.locator("#import-file").setInputFiles({
      name: "scope-replacement.html", mimeType: "text/html", buffer: await fixture.body()
    });
    await expect(page.locator("#data-policy")).toHaveText(/Unknown data|restrictive|未知数据/i);
    await expect(page.locator("#ai-context-scope-select")).toHaveValue("all");
  });
});
