import { describe, expect, it } from "vitest";
import { collectPaginationDiagnostics } from "../../studio-v2/core/render-diagnostics.js";

function geometry(node, values) {
  Object.defineProperty(node, "getBoundingClientRect", { configurable: true, value: () => ({ ...values, x: values.left, y: values.top }) });
  return node;
}

function makePage() {
  const page = geometry(document.createElement("section"), { left: 0, top: 0, right: 595, bottom: 822, width: 595, height: 822 });
  page.className = "printform_page";
  return page;
}

describe("deterministic pagination diagnostics", () => {
  it("identifies a tall row and a missing active table header with page geometry", () => {
    const page = makePage();
    const row = geometry(document.createElement("div"), { left: 0, top: 30, right: 595, bottom: 1016, width: 595, height: 986 });
    row.className = "prowitem_processed";
    row.dataset.pfTableId = "variation";
    page.appendChild(row);
    document.body.appendChild(page);

    const report = collectPaginationDiagnostics(document);
    expect(report.errors.map((entry) => entry.code)).toEqual(expect.arrayContaining(["ROW_TOO_TALL", "ACTIVE_TABLE_HEADER_MISSING"]));
    const tall = report.issues.find((entry) => entry.code === "ROW_TOO_TALL");
    expect(tall).toMatchObject({ component_id: "variation", page: 1, measured_size: { height: 986 }, available_size: { height: 822 } });
  });

  it("reports blank pages and explicit keep-together failures", () => {
    const blank = makePage();
    const page = makePage();
    const signature = geometry(document.createElement("div"), { left: 0, top: 780, right: 595, bottom: 900, width: 595, height: 120 });
    signature.className = "signature-block";
    signature.dataset.pfComponentId = "approved-by";
    signature.dataset.pfKeepTogether = "true";
    page.appendChild(signature);
    document.body.append(blank, page);

    const report = collectPaginationDiagnostics(document);
    expect(report.errors.map((entry) => entry.code)).toEqual(expect.arrayContaining(["BLANK_PAGE", "SIGNATURE_SPLIT"]));
    expect(report.metrics.blankPages).toBe(1);
    expect(report.metrics.keepTogetherFailures).toBeGreaterThan(0);
  });

  it("does not require ordinary table headers for PTAC/PADDT continuation rows", () => {
    document.body.innerHTML = "";
    const page = makePage();
    const terms = geometry(document.createElement("div"), { left: 0, top: 30, right: 595, bottom: 120, width: 595, height: 90 });
    terms.className = "ptac-rowitem_processed";
    page.appendChild(terms);
    document.body.appendChild(page);

    const report = collectPaginationDiagnostics(document);
    expect(report.errors.some((entry) => entry.code.startsWith("ACTIVE_TABLE_HEADER"))).toBe(false);
  });
});
