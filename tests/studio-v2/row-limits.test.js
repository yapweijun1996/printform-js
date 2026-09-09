import { describe, expect, it } from "vitest";
import { bindTemplate } from "../../studio-v2/core/binding.js";
import { measureBoundRows, resolveRowLimits, rowLimitErrors } from "../../studio-v2/core/row-limits.js";

function templateFor(...repeats) {
  const template = document.createElement("template");
  template.innerHTML = `<div class="printform">${repeats.join("")}</div>`;
  return template;
}

function rows(count) {
  return Array.from({ length: count }, (_, index) => ({ index }));
}

const limits = resolveRowLimits({ acceptance: { maxRows: 500, maxRowsPerTable: 500 } });

describe("bound table row limits", () => {
  it("counts actual table repeats and ignores nested non-table arrays", () => {
    const template = templateFor(
      '<div data-pf-each="/noise"></div>',
      '<table class="prowitem" data-pf-table-id="primary" data-pf-each="/primary"></table>',
      '<table class="prowitem" data-pf-table-id="secondary" data-pf-each="/secondary"></table>',
    );
    const report = measureBoundRows({ noise: rows(1000), primary: rows(400), secondary: rows(400) }, template);
    expect(report.total).toBe(800);
    expect(report.byTable).toEqual({ primary: 400, secondary: 400 });
    expect(rowLimitErrors(report, limits).map((item) => item.message)).toEqual([
      "Bound tables contain 800 rows; aggregate limit is 500",
    ]);
  });

  it("allows the exact per-table and aggregate limit, then blocks limit plus one", () => {
    const template = templateFor('<table class="prowitem" data-pf-each="/items"></table>');
    const exact = measureBoundRows({ items: rows(500) }, template);
    expect(rowLimitErrors(exact, limits)).toEqual([]);

    const over = measureBoundRows({ items: rows(501) }, template);
    expect(rowLimitErrors(over, limits).map((item) => item.message)).toEqual([
      "A bound table contains 501 rows; per-table limit is 500",
      "Bound tables contain 501 rows; aggregate limit is 500",
    ]);
  });

  it("keeps generic repeat reporting while exposing table rows separately", () => {
    const template = templateFor(
      '<div data-pf-each="/notes"><span data-pf-text="."></span></div>',
      '<table class="prowitem" data-pf-each="/items"></table>',
    );
    const bound = bindTemplate(template, { notes: rows(1000), items: rows(2) });
    expect(bound.report.rows).toBe(1002);
    expect(bound.report.tableRows).toBe(2);
    expect(bound.report.tableRowsByTable).toEqual({ default: 2 });
  });
});
