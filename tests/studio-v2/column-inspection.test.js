import { describe, expect, it } from "vitest";
import { inspectColumnGroups } from "../../studio-v2/core/column-inspection.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";
import { createPurchaseOrderProject } from "../../studio-v2/samples/purchase-order.js";

describe("inspectColumnGroups", () => {
  it("resolves labels and widths for the sales invoice table", () => {
    const project = createSalesInvoiceProject();
    const groups = inspectColumnGroups(project.templateHtml, project);
    expect(groups).toHaveLength(1);
    const [group] = groups;
    expect(group.tableSelector).toBe(".prowheader, .prowitem");
    expect(group.columns).toEqual([
      { label: "No.", width: "7%" },
      { label: "Description", width: "" },
      { label: "Qty", width: "11%" },
      { label: "Unit", width: "16%" },
      { label: "Amount", width: "18%" }
    ]);
  });

  it("resolves labels and widths for the purchase order table", () => {
    const project = createPurchaseOrderProject();
    const groups = inspectColumnGroups(project.templateHtml, project);
    expect(groups).toHaveLength(1);
    const [group] = groups;
    expect(group.tableSelector).toBe(".prowheader, .prowitem");
    expect(group.columns[0]).toEqual({ label: "No.", width: "5%" });
    expect(group.columns).toHaveLength(7);
  });

  it("falls back to a header-only selector when there is no matching item table", () => {
    const project = createSalesInvoiceProject();
    const templateHtml = project.templateHtml.replace(
      /<table class="prowitem[^]*?<\/table>/,
      ""
    );
    const groups = inspectColumnGroups(templateHtml, project);
    expect(groups).toHaveLength(1);
    expect(groups[0].tableSelector).toBe(".prowheader");
  });

  it("returns an empty list when the template has no row tables", () => {
    const project = createSalesInvoiceProject();
    const groups = inspectColumnGroups("<div>no tables here</div>", project);
    expect(groups).toEqual([]);
  });
});
