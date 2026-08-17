import { describe, expect, it } from "vitest";
import { validateProject } from "../../studio-v2/core/acceptance.js";
import { parseProjectHtml, serializeStandalone } from "../../studio-v2/core/project-model.js";
import { createProgressClaimProject } from "../../studio-v2/samples/progress-claim.js";

describe("Northpeak progress claim production sample", () => {
  it("ships a valid claim with reference-shaped sections and six valuation rows", () => {
    const project = createProgressClaimProject();
    expect(project.sampleData.valuationRows).toHaveLength(6);
    expect(project.sampleData.variations).toHaveLength(3);
    expect(validateProject(project)).toMatchObject({ valid: true, productionValid: true, errors: [] });
    expect(project.templateHtml).toContain("CONTRACT SUMMARY");
    expect(project.templateHtml).toContain("APPROVED / PENDING VARIATIONS");
    expect(project.templateHtml).toContain('data-pf-asset-slot="letterhead-logo"');
    expect(project.templateHtml).toContain('data-pf-each="/valuationRows"');
  });

  it("round-trips as a trusted standalone document", async () => {
    const project = createProgressClaimProject();
    const html = await serializeStandalone(
      project,
      { documentRuntime: "runtime=true;", printform: "printform=true;", runtimeVersion: "2.0.0" },
      validateProject(project)
    );
    const parsed = parseProjectHtml(html);
    expect(parsed.manifest.documentId).toBe("progress-claim-northpeak");
    expect(parsed.sampleData.valuationRows).toHaveLength(6);
    expect(parsed.sampleData.settlement.totalClaim).toBe("6,023,176.50");
    expect(parsed.attestation.result).toBe("pass");
  });
});
