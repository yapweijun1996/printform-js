import { describe, expect, it } from "vitest";
import { buildBrandColorBlock, currentBrandColor, setBrandColor, stripBrandColor } from "../../studio-v2/core/branding.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";
import { createPurchaseOrderProject } from "../../studio-v2/samples/purchase-order.js";

describe("brand color", () => {
  it("reads no color back when nothing has been injected", () => {
    expect(currentBrandColor("")).toBeNull();
    expect(currentBrandColor("body { color: red; }")).toBeNull();
  });

  it("writes and reads back a color", () => {
    const css = setBrandColor("", "#173d9a");
    expect(css).toContain(buildBrandColorBlock("#173d9a"));
    expect(currentBrandColor(css)).toBe("#173d9a");
  });

  it("replaces a prior injection instead of duplicating it", () => {
    const once = setBrandColor("body { color: red; }", "#173d9a");
    const twice = setBrandColor(once, "#8f1525");
    expect(twice.match(/--pf-brand-color/g)).toHaveLength(1);
    expect(currentBrandColor(twice)).toBe("#8f1525");
    expect(twice).toContain("body { color: red; }");
  });

  it("strips the injected block without touching the rest of the CSS", () => {
    const css = setBrandColor("body { color: red; }", "#173d9a");
    expect(stripBrandColor(css)).toBe("body { color: red; }");
  });

  it("both standard samples reference the variable instead of a hardcoded .pf-brand color", () => {
    const invoice = createSalesInvoiceProject();
    expect(currentBrandColor(invoice.themeCss)).toBe("#173d9a");
    expect(invoice.themeCss).toContain(".pf-brand { margin: 0; color: var(--pf-brand-color);");

    const purchaseOrder = createPurchaseOrderProject();
    expect(currentBrandColor(purchaseOrder.themeCss)).toBe("#8f1525");
    expect(purchaseOrder.themeCss).toContain(".pf-brand { margin: 0; color: var(--pf-brand-color);");
  });
});
