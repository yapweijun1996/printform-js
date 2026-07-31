import { describe, expect, it } from "vitest";
import { inspectPageSettings, inspectRepeatFlags } from "../../studio-v2/core/page-inspection.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";
import { createPurchaseOrderProject } from "../../studio-v2/samples/purchase-order.js";

describe("inspectPageSettings", () => {
  it("reads the papersize width/height off the sales invoice template", () => {
    const project = createSalesInvoiceProject();
    expect(inspectPageSettings(project.templateHtml)).toEqual({ selector: ".printform", width: 750, height: 1050 });
  });

  it("reads the papersize width/height off the purchase order template", () => {
    const project = createPurchaseOrderProject();
    expect(inspectPageSettings(project.templateHtml)).toEqual({ selector: ".printform", width: 750, height: 1050 });
  });

  it("returns null when the template has no .printform root", () => {
    expect(inspectPageSettings("<div>no printform root here</div>")).toBeNull();
  });

  it("returns null when the papersize attributes are missing or non-numeric", () => {
    expect(inspectPageSettings('<section class="printform"></section>')).toBeNull();
    expect(inspectPageSettings('<section class="printform" data-papersize-width="abc" data-papersize-height="1050"></section>')).toBeNull();
  });
});

describe("inspectRepeatFlags", () => {
  it("reads all seven known repeat flags off the sales invoice template in order", () => {
    const project = createSalesInvoiceProject();
    expect(inspectRepeatFlags(project.templateHtml)).toEqual([
      { key: "header", attribute: "data-repeat-header", value: true },
      { key: "docinfo", attribute: "data-repeat-docinfo", value: true },
      { key: "rowheader", attribute: "data-repeat-rowheader", value: true },
      { key: "ptacRowheader", attribute: "data-repeat-ptac-rowheader", value: false },
      { key: "footer", attribute: "data-repeat-footer", value: false },
      { key: "footerLogo", attribute: "data-repeat-footer-logo", value: true },
      { key: "footerPagenum", attribute: "data-repeat-footer-pagenum", value: true }
    ]);
  });

  it("omits a flag that the template never set instead of guessing the engine default", () => {
    const flags = inspectRepeatFlags('<section class="printform" data-repeat-header="y"></section>');
    expect(flags).toEqual([{ key: "header", attribute: "data-repeat-header", value: true }]);
  });

  it("returns an empty list when the template has no .printform root", () => {
    expect(inspectRepeatFlags("<div>no printform root here</div>")).toEqual([]);
  });
});
