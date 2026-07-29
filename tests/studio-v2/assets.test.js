import { describe, expect, it } from "vitest";
import { inlineProjectAssets, validateAssetSlots } from "../../studio-v2/core/assets.js";
import { applyOperations } from "../../studio-v2/core/operations.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";

describe("standalone asset policy", () => {
  it("rejects session-only blob URLs", async () => {
    const project = createSalesInvoiceProject();
    project.templateHtml += '<img src="blob:https://studio.test/session" alt="temporary">';
    await expect(inlineProjectAssets(project, "https://studio.test/")).rejects.toMatchObject({ code: "BLOB_ASSET_UNSUPPORTED" });
  });

  it("preserves already inlined data URLs without network access", async () => {
    const project = createSalesInvoiceProject();
    project.templateHtml += '<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA==" alt="pixel">';
    const result = await inlineProjectAssets(project, "https://studio.test/");
    expect(result.project.templateHtml).toContain("data:image/gif;base64");
  });

  it("validates and safely replaces declared logo slots", () => {
    const project = createSalesInvoiceProject();
    expect(validateAssetSlots(project).valid).toBe(true);
    const changed = applyOperations(project, [{ type: "set_asset_slot", slot: "footer-logo", source: "https://assets.example.com/footer.png" }]);
    expect(changed.templateHtml).toContain("https://assets.example.com/footer.png");
    const invalid = applyOperations(project, [{ type: "set_asset_slot", slot: "footer-logo", source: "javascript:alert(1)" }]);
    expect(validateAssetSlots(invalid).errors).toContainEqual(expect.objectContaining({ code: "ASSET_SOURCE_UNSAFE" }));
  });
});
