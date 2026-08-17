import { expect, test } from "@playwright/test";

test("repeats the active table header across sequential long tables", async ({ page }) => {
  await page.goto("/index001.html");
  await page.evaluate(() => {
    document.querySelectorAll(".printform_formatter_processed, .div_page_break_before").forEach((node) => node.remove());
    const style = document.createElement("style");
    style.textContent = `
      .active-table-test { width: 420px; font: 14px Arial; }
      .active-table-test .pheader { height: 30px; }
      .active-table-test .prowheader { height: 28px; font-weight: 700; }
      .active-table-test .prowitem { height: 36px; }
    `;
    document.head.appendChild(style);
    const form = document.createElement("div");
    form.className = "paper_width printform active-table-test";
    [
      ["valuation", "Valuation", 24],
      ["variation", "Variation", 24],
      ["materials", "Materials", 24],
      ["certification", "Certification", 24],
    ].forEach(([tableId, label, count]) => {
      const header = document.createElement("div");
      header.className = "prowheader";
      header.dataset.pfTableId = tableId;
      header.textContent = `${label} header`;
      form.appendChild(header);
      for (let index = 0; index < count; index += 1) {
        const row = document.createElement("div");
        row.className = "prowitem";
        row.dataset.pfTableId = tableId;
        row.textContent = `${label} row ${index + 1}`;
        form.appendChild(row);
      }
    });
    form.dataset.papersizeWidth = "420";
    form.dataset.papersizeHeight = "260";
    form.dataset.repeatHeader = "n";
    form.dataset.repeatDocinfo = "n";
    form.dataset.repeatRowheader = "y";
    form.dataset.insertDummyRowItemWhileFormatTable = "n";
    form.dataset.insertFooterSpacerWhileFormatTable = "n";
    document.body.appendChild(form);
    window.PrintForm.format(form);
  });

  const pages = page.locator(".printform_formatter_processed .printform_page");
  await expect(pages.first()).toBeVisible({ timeout: 15_000 });
  expect(await pages.count()).toBeGreaterThan(3);
  const summaries = await pages.evaluateAll((pageNodes) => pageNodes.map((pageNode) => {
    const rows = Array.from(pageNode.querySelectorAll(".prowitem_processed"), (node) => node.dataset.pfTableId);
    const headers = Array.from(pageNode.querySelectorAll(".prowheader_processed"), (node) => node.dataset.pfTableId);
    return { rows, headers };
  }));
  expect(summaries.some(({ rows }) => rows.includes("variation"))).toBe(true);
  expect(summaries.some(({ rows }) => rows.includes("materials"))).toBe(true);
  summaries.forEach(({ rows, headers }) => {
    new Set(rows).forEach((tableId) => expect(headers).toContain(tableId));
    if (rows.length && rows.every((tableId) => tableId === "variation")) expect(headers).not.toContain("valuation");
    if (rows.length && rows.every((tableId) => tableId === "materials")) expect(headers).not.toContain("variation");
    if (rows.length && rows.every((tableId) => tableId === "certification")) expect(headers).not.toContain("materials");
  });
});
