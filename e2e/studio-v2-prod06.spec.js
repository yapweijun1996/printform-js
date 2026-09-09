import { expect, test } from "@playwright/test";

test.describe.configure({ timeout: 180_000 });

test("PROD-06 scopes repeatHeader to one table while preserving the legacy root flag", async ({ page }) => {
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(`console: ${message.text()}`); });
  await page.goto("/index001.html");
  const result = await page.evaluate(async () => {
    const { applyOperations } = await import("/studio-v2/core/operations.js");
    const { bindTemplate } = await import("/studio-v2/core/binding.js");
    const rows = (tableId, count) => Array.from({ length: count }, (_, index) => ({ tableId, index }));
    const source = `<section class="printform" data-papersize-width="500" data-papersize-height="180" data-repeat-header="n" data-repeat-docinfo="n" data-repeat-rowheader="n" data-insert-dummy-row-item-while-format-table="n" data-insert-footer-spacer-while-format-table="n" data-fill-page-height-after-footer="n">
      <div class="prowheader prod06-header" data-pf-table-id="a" data-pf-component-id="table-a-header" style="height:24px">A header</div>
      <div class="prowitem prod06-row" data-pf-table-id="a" data-pf-each="/a" style="height:32px">A row</div>
      <div class="prowheader prod06-header" data-pf-table-id="b" data-pf-component-id="table-b-header" style="height:24px">B header</div>
      <div class="prowitem prod06-row" data-pf-table-id="b" data-pf-each="/b" style="height:32px">B row</div>
    </section>`;
    const project = { manifest: {}, schema: {}, i18n: {}, themeCss: "", templateHtml: source, sampleData: {}, attestation: null, runtime: null, trust: "trusted", trustReasons: [], customScripts: [], sourceHtml: "", revision: 0 };
    const candidate = applyOperations(project, [
      { type: "set_pagination_rule", componentId: "table-a-header", rule: "repeatHeader", value: false },
      { type: "set_pagination_rule", componentId: "table-b-header", rule: "repeatHeader", value: true },
    ]);
    const candidateTemplate = document.createElement("template");
    candidateTemplate.innerHTML = candidate.templateHtml;
    const localFlags = Array.from(candidateTemplate.content.querySelectorAll(".prowheader"), (node) => ({
      tableId: node.getAttribute("data-pf-table-id"), local: node.getAttribute("data-pf-repeat-rowheader"),
    }));
    const bound = bindTemplate(candidateTemplate, { a: rows("a", 6), b: rows("b", 6) });
    bound.fragment.querySelector(".printform").classList.add("prod06-form");
    const firstB = bound.fragment.querySelector('.prowitem[data-pf-table-id="b"]');
    firstB.classList.add("tb_page_break_before");
    document.body.append(bound.fragment);
    const form = document.querySelector(".prod06-form");
    window.PrintForm.format(form);
    const output = Array.from(document.querySelectorAll(".printform_formatter_processed"))
      .find((container) => container.querySelector(".prod06-row"));
    const summarize = (container, rowSelector, headerSelector) => Array.from(container.querySelectorAll(".printform_page"), (page) => ({
      rows: Array.from(page.querySelectorAll(rowSelector), (node) => node.getAttribute("data-pf-table-id") || "default"),
      headers: Array.from(page.querySelectorAll(headerSelector), (node) => node.getAttribute("data-pf-table-id") || "default"),
    }));
    const scopedPages = summarize(output, ".prowitem_processed.prod06-row", ".prowheader_processed.prod06-header");

    const legacyForm = document.createElement("section");
    legacyForm.className = "printform";
    Object.assign(legacyForm.dataset, { papersizeWidth: "500", papersizeHeight: "140", repeatHeader: "n", repeatDocinfo: "n", repeatRowheader: "n", insertDummyRowItemWhileFormatTable: "n", insertFooterSpacerWhileFormatTable: "n", fillPageHeightAfterFooter: "n" });
    const legacyHeader = document.createElement("div");
    legacyHeader.className = "prowheader legacy-header";
    legacyHeader.style.height = "24px";
    legacyHeader.textContent = "Legacy header";
    legacyForm.append(legacyHeader);
    rows("default", 6).forEach(({ index }) => {
      const row = document.createElement("div");
      row.className = "prowitem legacy-row";
      row.style.height = "32px";
      row.textContent = `Legacy ${index}`;
      legacyForm.append(row);
    });
    document.body.append(legacyForm);
    window.PrintForm.format(legacyForm);
    const legacyOutput = Array.from(document.querySelectorAll(".printform_formatter_processed"))
      .find((container) => container.querySelector(".legacy-row"));
    const result = {
      localFlags,
      specFlags: candidate.spec.components.filter((item) => item.role === "table-header").map((item) => ({ id: item.id, repeatHeader: item.repeatHeader })),
      scopedPages,
      legacyPages: summarize(legacyOutput, ".prowitem_processed.legacy-row", ".prowheader_processed.legacy-header"),
    };
    return result;
  });

  expect(result.localFlags).toEqual([{ tableId: "a", local: "n" }, { tableId: "b", local: "y" }]);
  if (!result.scopedPages.some((page) => page.rows.includes("a"))) throw new Error(`PROD06_RESULT ${JSON.stringify(result)}`);
  expect(result.specFlags).toEqual([{ id: "table-a-header", repeatHeader: false }, { id: "table-b-header", repeatHeader: true }]);
  const aPages = result.scopedPages.filter((page) => page.rows.includes("a"));
  const bPages = result.scopedPages.filter((page) => page.rows.includes("b"));
  expect(aPages.length).toBeGreaterThan(1);
  expect(aPages[0].headers).toContain("a");
  expect(aPages.slice(1).every((page) => !page.headers.includes("a"))).toBe(true);
  expect(bPages.length).toBeGreaterThan(1);
  expect(bPages.every((page) => page.headers.includes("b"))).toBe(true);
  expect(result.legacyPages.length).toBeGreaterThan(1);
  expect(result.legacyPages[0].headers).toContain("default");
  expect(result.legacyPages.slice(1).every((page) => !page.headers.includes("default"))).toBe(true);
  expect(browserErrors).toEqual([]);
});
