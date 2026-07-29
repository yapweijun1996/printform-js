import { describe, expect, it } from "vitest";
import { inlineProjectAssets } from "../../studio-v2/core/assets.js";
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
});
