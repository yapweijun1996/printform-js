import { describe, expect, it } from "vitest";
import { validateProject } from "../../studio-v2/core/acceptance.js";
import { validateBusinessRules } from "../../studio-v2/core/business-rules.js";
import { createScenario } from "../../studio-v2/core/sample-scenarios.js";
import { serializeStandalone, parseProjectHtml } from "../../studio-v2/core/project-model.js";
import { createPurchaseOrderProject } from "../../studio-v2/samples/purchase-order.js";

describe("Crimson purchase order production sample", () => {
  it("ships a valid 32-row ERP-shaped project with consistent totals", () => {
    const project = createPurchaseOrderProject();
    expect(project.sampleData.items).toHaveLength(32);
    expect(project.sampleData.totals).toEqual({ subtotal: 61116, tax: 4889.28, shipping: 180, grandTotal: 66185.28 });
    expect(validateProject(project)).toMatchObject({ valid: true, productionValid: true, errors: [] });
    expect(project.templateHtml).toContain('data-pf-asset-slot="letterhead-logo"');
    expect(project.templateHtml).toContain('data-pf-asset-slot="footer-logo"');
    expect(project.templateHtml).toContain('<footer class="pfooter pf-order-footer">');
    expect(project.templateHtml).not.toContain('<section class="ptac">');
  });

  it("recalculates financial truth for generated boundary rows", () => {
    const project = createPurchaseOrderProject();
    for (const scenario of ["one", "45-rows", "500-rows", "long-text"]) {
      project.sampleData = createScenario(createPurchaseOrderProject().sampleData, scenario);
      const validation = validateProject(project);
      expect(validation.errors.filter((item) => item.code.endsWith("_MISMATCH"))).toEqual([]);
      expect(validation.productionValid).toBe(true);
    }
  });

  it("blocks inconsistent ERP line and document totals", () => {
    const data = createPurchaseOrderProject().sampleData;
    data.items[0].lineTotal += 1;
    const result = validateBusinessRules(data);
    expect(result.errors.map((item) => item.code)).toEqual(expect.arrayContaining(["LINE_TOTAL_MISMATCH", "SUBTOTAL_MISMATCH"]));
  });

  it("round-trips as one trusted HTML document", async () => {
    const project = createPurchaseOrderProject();
    const html = await serializeStandalone(project, { documentRuntime: "runtime=true;", printform: "printform=true;", runtimeVersion: "2.0.0" }, validateProject(project));
    const parsed = parseProjectHtml(html);
    expect(parsed.manifest.documentId).toBe("purchase-order-crimson");
    expect(parsed.sampleData.items).toHaveLength(32);
    expect(parsed.i18n["zh-CN"]["po.title"]).toBe("采购订单");
    expect(parsed.attestation.result).toBe("pass");
  });
});
