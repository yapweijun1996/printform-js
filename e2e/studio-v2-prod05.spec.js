import { expect, test } from "@playwright/test";

test.describe.configure({ timeout: 180_000 });

test("PROD-05 enforces bound-table limits and preserves rendered row order", async ({ page }) => {
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(`console: ${message.text()}`); });
  await page.goto("/index001.html");
  const result = await page.evaluate(async () => {
    const { bindTemplate } = await import("/studio-v2/core/binding.js");
    const { measureBoundRows, resolveRowLimits, rowLimitErrors } = await import("/studio-v2/core/row-limits.js");
    const limits = resolveRowLimits({ acceptance: { maxRows: 500, maxRowsPerTable: 500 } });
    const makeRows = (count) => Array.from({ length: count }, (_, index) => ({ index }));
    const limitTemplate = document.createElement("template");
    limitTemplate.innerHTML = `<div class="printform"><div data-pf-each="/noise"></div><table class="prowitem" data-pf-table-id="primary" data-pf-each="/primary"></table><table class="prowitem" data-pf-table-id="secondary" data-pf-each="/secondary"></table></div>`;
    const check = (primary, secondary, noise) => {
      const report = measureBoundRows({ primary: makeRows(primary), secondary: makeRows(secondary), noise: makeRows(noise) }, limitTemplate);
      return { total: report.total, byTable: report.byTable, errors: rowLimitErrors(report, limits).map((item) => item.message) };
    };
    const cases = {
      twoTables: check(400, 400, 1000),
      exact: check(500, 0, 1000),
      plusOne: check(501, 0, 0),
    };

    const renderTemplate = document.createElement("template");
    renderTemplate.innerHTML = `<div id="prod05-form" class="paper_width printform" data-papersize-width="600" data-papersize-height="780" data-repeat-header="n" data-repeat-docinfo="n" data-repeat-rowheader="y" data-insert-dummy-row-item-while-format-table="n" data-insert-footer-spacer-while-format-table="n" data-fill-page-height-after-footer="n"><div class="prowheader">Rows</div><div class="prowitem" data-pf-each="/items"><span data-pf-text="./index"></span></div></div>`;
    const bound = bindTemplate(renderTemplate, { items: makeRows(500) });
    document.body.append(bound.fragment);
    const form = document.querySelector("#prod05-form");
    window.PrintForm.format(form);
    const rendered = Array.from(form.querySelectorAll(".prowitem_processed"), (node) => Number(node.querySelector("span")?.textContent));
    return { cases, boundRows: bound.report.tableRows, renderedRows: rendered.length, firstRows: rendered.slice(0, 3), lastRows: rendered.slice(-3) };
  });

  expect(result.cases.twoTables).toMatchObject({ total: 800, byTable: { primary: 400, secondary: 400 }, errors: ["Bound tables contain 800 rows; aggregate limit is 500"] });
  expect(result.cases.exact).toMatchObject({ total: 500, errors: [] });
  expect(result.cases.plusOne.errors).toEqual([
    "A bound table contains 501 rows; per-table limit is 500",
    "Bound tables contain 501 rows; aggregate limit is 500",
  ]);
  expect(result.boundRows).toBe(500);
  expect(result.renderedRows).toBe(500);
  expect(result.firstRows).toEqual([0, 1, 2]);
  expect(result.lastRows).toEqual([497, 498, 499]);
  expect(browserErrors).toEqual([]);
});
