import { expect, test } from "@playwright/test";

// Studio v1 (studio/) is frozen — bug-fix-only — but had zero real-browser
// regression coverage before this spec, despite this session's security
// fixes there (raw-template structure mode, postMessage origin checks,
// strict mustache-lite). This locks in the single highest-value invariant:
// structure mode must expose the RAW, unrendered template so block indices
// match what applyBlockEdit/deleteBlock act on and {{ }} bindings survive
// editing — the bug this session's fix corrected.

test("renders a preview and reports a page count for a plain (non-data-bound) template", async ({ page }) => {
  await page.goto("/studio/index.html");
  await page.locator("#template-select").selectOption("demo001");
  await expect(page.locator("#status-a")).toHaveText(/\d/, { timeout: 20_000 });
  const pageCount = await page.frameLocator("#frame-a").locator(".printform_page").count();
  expect(pageCount).toBeGreaterThan(0);
});

test("structure mode shows the raw template with {{ }} placeholders intact, not sample-rendered values", async ({ page }) => {
  await page.goto("/studio/index.html");
  await page.locator("#template-select").selectOption("databound");
  await expect(page.locator("#status-a")).toHaveText(/\d/, { timeout: 20_000 });

  await page.locator("#mode-toggle").click();
  // Raw template has 5 direct children; the pre-fix bug rendered sample data
  // first, which expands {{#items}} into one block per generated row and
  // desynchronizes every index used by the block editor.
  await expect(page.locator("#status-a")).toHaveText("5 个区块", { timeout: 20_000 });

  const row = page.frameLocator("#frame-a").locator('.studio-block[data-studio-label="prowitem"]');
  await row.click();
  await expect(page.locator("#be-type")).toHaveText("prowitem");
  await expect(page.locator("#be-html")).toHaveValue(/\{\{\s*name\s*\}\}/);
});
