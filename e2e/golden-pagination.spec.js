import { expect, test } from "@playwright/test";

// Golden-master pagination fixtures (ROADMAP.md §2.1 "分页黄金样本") — a
// stricter, purpose-built safety net for the P2 pagination-engine rewrite
// (PaginationSession/PageContext/LayoutPlan), distinct from the lighter
// smoke checks in core-pagination.spec.js. Every number here was captured
// from the CURRENT renderer via a live browser (not guessed from source),
// so a red run means the page/row distribution genuinely changed — the
// P2 rewrite's explicit acceptance bar is "no regression against the old
// samples" (ROADMAP.md §2.1), and these are exactly the samples to diff
// against. If a future intentional layout change legitimately shifts these
// numbers, update the expected arrays in the same commit as the change and
// say why in the commit message — don't loosen the assertions to "greater
// than 0".

test("demo001 (45-row ERP sales invoice + PTAC): fixed page count, item rows on pages 1-2, PTAC terms on pages 3-7", async ({ page }) => {
  await page.goto("/demo001.html");
  const pages = page.locator(".printform_page");
  await expect(pages).toHaveCount(8, { timeout: 15_000 });
  const perPage = await pages.evaluateAll((nodes) => nodes.map((node) => ({
    prowitem: node.querySelectorAll(".prowitem_processed").length,
    ptac: node.querySelectorAll(".ptac-rowitem_processed").length
  })));
  expect(perPage.map((entry) => entry.prowitem)).toEqual([23, 22, 0, 0, 0, 0, 0, 0]);
  expect(perPage.map((entry) => entry.ptac)).toEqual([0, 0, 4, 3, 3, 3, 4, 0]);
  expect(perPage.reduce((sum, entry) => sum + entry.prowitem, 0)).toBe(45);
  expect(perPage.reduce((sum, entry) => sum + entry.ptac, 0)).toBe(17);
});

test("delivery_order_test (PTAC+PADDT combination): PADDT segments render after every regular footer, on their own trailing pages", async ({ page }) => {
  await page.goto("/delivery_order_test.html");
  const pages = page.locator(".printform_page");
  await expect(pages).toHaveCount(4, { timeout: 15_000 });
  const rowsPerPage = await pages.evaluateAll((nodes) => nodes.map((node) => node.querySelectorAll(".prowitem_processed").length));
  expect(rowsPerPage).toEqual([17, 21, 10, 0]);
  const ptacPerPage = await pages.evaluateAll((nodes) => nodes.map((node) => node.querySelectorAll(".ptac-rowitem_processed").length));
  const paddtPerPage = await pages.evaluateAll((nodes) => nodes.map((node) => node.querySelectorAll(".paddt-rowitem_processed").length));
  expect(ptacPerPage).toEqual([3, 0, 0, 0]);
  // PADDT is architecturally required to start a fresh physical page after
  // ALL regular footers on every prior page — it must never share a page
  // with prowitem/ptac content or appear before the final footer.
  expect(paddtPerPage).toEqual([0, 0, 0, 4]);
});

test("index015 (2-up A5-on-A4): logical/physical page split stays 2-per-sheet with a partial final sheet", async ({ page }) => {
  await page.goto("/index015.html");
  const logicalPages = page.locator(".printform_page");
  await expect(logicalPages).toHaveCount(7, { timeout: 15_000 });
  const physicalWrappers = page.locator(".physical_page_wrapper");
  await expect(physicalWrappers).toHaveCount(4);
  const logicalPerPhysical = await physicalWrappers.evaluateAll((nodes) => nodes.map((node) => node.querySelectorAll(".printform_page").length));
  // n_up=2: every physical sheet carries 2 logical pages except the last,
  // which carries the odd one out.
  expect(logicalPerPhysical).toEqual([2, 2, 2, 1]);
  const rowsPerPage = await logicalPages.evaluateAll((nodes) => nodes.map((node) => node.querySelectorAll(".prowitem_processed").length));
  expect(rowsPerPage).toEqual([5, 5, 5, 1, 2, 2, 2]);
});
