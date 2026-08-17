import { afterEach, describe, expect, it, vi } from "vitest";
import { createStandaloneHtml } from "../../studio-v2/core/exporter.js";
import { validateProject } from "../../studio-v2/core/acceptance.js";
import { parseProjectHtml } from "../../studio-v2/core/project-model.js";
import { sha256 } from "../../studio-v2/core/json.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";

afterEach(() => vi.unstubAllGlobals());

describe("trusted export evidence", () => {
  it("embeds the revision, security result and normalized export hash in the artifact", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url) => ({
      ok: true,
      text: async () => String(url).includes("printform-document") ? "document-runtime" : "printform-runtime",
    })));
    const project = createSalesInvoiceProject();
    const result = await createStandaloneHtml(project, {
      requireTrusted: true,
      validation: validateProject(project),
      revision: 7,
      previewHash: "sha256:preview",
    });
    const parsed = parseProjectHtml(result.html);
    expect(parsed.attestation.evidence).toMatchObject({
      revision: 7,
      previewHash: "sha256:preview",
      exportHtmlHash: result.evidencePack.exportHtmlHash,
      security: { status: "PASS", externalNetwork: false, arbitraryJavascript: false },
    });
    expect(result.evidencePack).toMatchObject({ pageCount: 0, exportHtmlHash: expect.stringMatching(/^sha256:/), runtimeVersion: "2.0.0" });
    const normalized = result.html.replace(/("exportHtmlHash":\s*)"sha256:[^"]*"/, "$1null");
    expect(result.evidencePack.exportHtmlHash).toBe(`sha256:${await sha256(normalized)}`);
  });
});
