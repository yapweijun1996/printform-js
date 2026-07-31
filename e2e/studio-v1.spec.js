import { expect, test } from "@playwright/test";

// The two waits below (see waitForRenderedPages and the structure-mode status
// assertion) wait on real rendering, not a fixed poll count — confirmed by
// reproducing this file's flake under a fully-loaded local suite (5 workers x
// 3 browser engines on a 10-core machine): the firefox render that failed
// past a 20s timeout showed, once captured, a fully-finished 8-page render —
// it just took longer than 20s to get there under contention, it never hung.
// Bumped both the per-wait timeouts (20s -> 40s) and the file's overall test
// timeout (45s -> 120s) so two chained waits have real headroom instead of
// racing a budget that two 20s waits alone could already exceed. A genuinely
// broken wait still fails well before reaching either ceiling.
test.describe.configure({ timeout: 120_000 });
const RENDER_WAIT_MS = 40_000;

// Studio v1 (studio/) is frozen — bug-fix-only — but had zero real-browser
// regression coverage before this spec, despite this session's security
// fixes there (raw-template structure mode, postMessage origin checks,
// strict mustache-lite). This locks in the single highest-value invariant:
// structure mode must expose the RAW, unrendered template so block indices
// match what applyBlockEdit/deleteBlock act on and {{ }} bindings survive
// editing — the bug this session's fix corrected.

// Wait on the rendered pages themselves, never on #status-a as a proxy: the
// status still holds the PREVIOUS template's "N 页" for a moment after a new
// selection, so a /\d/ match can be satisfied before the newly selected
// template has even started rendering — and the count then runs against a
// reloading iframe and reads 0. That race made this spec flaky under parallel
// load while passing in isolation.
async function waitForRenderedPages(page) {
  await expect(page.frameLocator("#frame-a").locator(".printform_page").first()).toBeVisible({ timeout: RENDER_WAIT_MS });
}

test("renders a preview and reports a page count for a plain (non-data-bound) template", async ({ page }) => {
  await page.goto("/studio/index.html");
  await page.locator("#template-select").selectOption("demo001");
  await waitForRenderedPages(page);
  const pageCount = await page.frameLocator("#frame-a").locator(".printform_page").count();
  expect(pageCount).toBeGreaterThan(0);
});

test("structure mode shows the raw template with {{ }} placeholders intact, not sample-rendered values", async ({ page }) => {
  await page.goto("/studio/index.html");
  await page.locator("#template-select").selectOption("databound");
  await waitForRenderedPages(page);

  await page.locator("#mode-toggle").click();
  // Raw template has 5 direct children; the pre-fix bug rendered sample data
  // first, which expands {{#items}} into one block per generated row and
  // desynchronizes every index used by the block editor.
  await expect(page.locator("#status-a")).toHaveText("5 个区块", { timeout: RENDER_WAIT_MS });

  const row = page.frameLocator("#frame-a").locator('.studio-block[data-studio-label="prowitem"]');
  await row.click();
  await expect(page.locator("#be-type")).toHaveText("prowitem");
  await expect(page.locator("#be-html")).toHaveValue(/\{\{\s*name\s*\}\}/);
});
