import { describe, expect, it } from "vitest";
import { inspectRenderedDocument } from "../../studio-v2/core/acceptance.js";

describe("rendered document acceptance", () => {
  it("blocks a logical page taller than the declared paper height", () => {
    document.documentElement.lang = "en-MY";
    document.head.innerHTML = "<title>Overflow test</title>";
    document.body.innerHTML = `
      <template id="pf-template"><section class="printform" data-papersize-height="1050"></section></template>
      <section class="printform_page"></section>`;
    const page = document.querySelector(".printform_page");
    Object.defineProperty(page, "scrollHeight", { configurable: true, value: 1062 });
    page.getBoundingClientRect = () => ({ left: 0, right: 750, top: 0, bottom: 1062, width: 750, height: 1062 });
    const report = inspectRenderedDocument(document, { acceptance: { maxLogicalPages: 100 } });
    expect(report.valid).toBe(false);
    expect(report.errors.some((item) => item.code === "VERTICAL_OVERFLOW")).toBe(true);
    expect(report.metrics.verticalOverflowPages).toBe(1);
  });

  function setupRowFixture(renderedRowCount) {
    document.documentElement.lang = "en-MY";
    document.title = "Row count test";
    document.head.innerHTML = "<title>Row count test</title>";
    const rows = Array.from({ length: renderedRowCount }, (_, i) => `<div class="prowitem_processed">row ${i}</div>`).join("");
    document.body.innerHTML = `
      <template id="pf-template"><section class="printform" data-papersize-height="1050"></section></template>
      <section class="printform_page">${rows}</section>`;
    const page = document.querySelector(".printform_page");
    page.getBoundingClientRect = () => ({ left: 0, right: 750, top: 0, bottom: 100, width: 750, height: 100 });
  }

  it("flags ROW_COUNT_MISMATCH when the pagination engine renders fewer rows than the binder produced (a dropped row)", () => {
    setupRowFixture(44); // binder produced 45, only 44 made it into the output
    const report = inspectRenderedDocument(document, { acceptance: { maxLogicalPages: 100 } }, { expectedRowCount: 45 });
    expect(report.valid).toBe(false);
    expect(report.errors.some((item) => item.code === "ROW_COUNT_MISMATCH")).toBe(true);
    expect(report.metrics).toMatchObject({ renderedRows: 44, expectedRows: 45 });
  });

  it("flags ROW_COUNT_MISMATCH when there are MORE rendered rows than bound (a duplicated row)", () => {
    setupRowFixture(46);
    const report = inspectRenderedDocument(document, { acceptance: { maxLogicalPages: 100 } }, { expectedRowCount: 45 });
    expect(report.errors.some((item) => item.code === "ROW_COUNT_MISMATCH")).toBe(true);
  });

  it("does not flag ROW_COUNT_MISMATCH when the counts match", () => {
    setupRowFixture(45);
    const report = inspectRenderedDocument(document, { acceptance: { maxLogicalPages: 100 } }, { expectedRowCount: 45 });
    expect(report.errors.some((item) => item.code === "ROW_COUNT_MISMATCH")).toBe(false);
    expect(report.metrics).toMatchObject({ renderedRows: 45, expectedRows: 45 });
  });

  it("skips the row-count check entirely when expectedRowCount is not provided (e.g. the CLI validator, which has no live binder report)", () => {
    setupRowFixture(45);
    const report = inspectRenderedDocument(document, { acceptance: { maxLogicalPages: 100 } });
    expect(report.errors.some((item) => item.code === "ROW_COUNT_MISMATCH")).toBe(false);
    expect(report.metrics.expectedRows).toBeUndefined();
    expect(report.metrics.renderedRows).toBe(45);
  });
});
