import { describe, expect, it } from "vitest";
import { createRedactedLayoutSnapshot } from "../../studio-v2/ui/layout-snapshot.js";
import { executeAgentCommand } from "../../studio-v2/adapters/gateway.js";
import { sanitizeAgentResult } from "../../studio-v2/core/agent-sanitize.js";
import { CommandBus } from "../../studio-v2/core/command-bus.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";

const report = {
  status: "ready",
  pageGeometry: [{ width: 794, height: 1123, children: [{ x: 10, y: 20, width: 774, height: 90 }] }],
  issues: [{ pageIndex: 0, rect: { x: 12, y: 40, width: 40, height: 12 }, text: "Customer secret" }],
  metrics: { logicalPages: 1 }
};

describe("redacted multimodal layout evidence", () => {
  it("renders geometry-only SVG without document text, class names or images", () => {
    const snapshot = createRedactedLayoutSnapshot(report);
    const svg = atob(snapshot.dataUrl.split(",", 2)[1]);
    expect(snapshot).toMatchObject({ source: "geometry-only", redacted: true, mimeType: "image/svg+xml", pageCount: 1 });
    expect(svg).toContain("<rect");
    expect(svg).not.toContain("Customer secret");
    expect(svg).not.toContain("<text");
    expect(svg).not.toContain("<image");
    expect(svg).not.toContain("https://");
  });

  it("keeps a safe snapshot in sanitized evidence while removing ERP values", async () => {
    const project = createSalesInvoiceProject();
    project.sampleData.items[0].description = "ERP SECRET CUSTOMER TEXT";
    const bus = new CommandBus(project, { renderCandidate: async () => ({ ...report, safeSnapshot: createRedactedLayoutSnapshot(report) }) });
    const result = await executeAgentCommand(bus, "capture_layout_evidence", { expectedRevision: 0, scenario: "default" }, { realData: true });
    const serialized = JSON.stringify(result);
    expect(result.ok).toBe(true);
    expect(result.result.evidence.snapshot).toMatchObject({ source: "geometry-only", redacted: true, mimeType: "image/svg+xml" });
    expect(serialized).not.toContain("ERP SECRET CUSTOMER TEXT");
    expect(serialized).not.toContain("Customer secret");
  });

  it("strips a pixel snapshot if a real-data result reaches the sanitizer", () => {
    const secretPixels = "data:image/png;base64,REAL_DATA_PIXEL_BYTES";
    const result = sanitizeAgentResult("capture_layout_evidence", {
      evidence: { visualMode: "pixels", pixelSnapshotHash: "a".repeat(64), pixelSnapshot: { source: "sandbox-pixel", syntheticData: true, redacted: false, mimeType: "image/png", dataUrl: secretPixels } }
    }, { realData: true });
    expect(JSON.stringify(result)).not.toContain(secretPixels);
    expect(result.evidence).not.toHaveProperty("pixelSnapshot");
    expect(result.evidence).not.toHaveProperty("pixelSnapshotHash");
  });

  it("strips pixels from an unsigned broken-layout observation in real-data mode", () => {
    const secretPixels = "data:image/png;base64,REAL_DATA_OBSERVATION";
    const result = sanitizeAgentResult("capture_layout_evidence", {
      observation: {
        revision: 2, scenario: "long-text", visualMode: "pixels",
        snapshot: createRedactedLayoutSnapshot(report),
        pixelSnapshot: { source: "sandbox-pixel", syntheticData: true, redacted: false, mimeType: "image/png", dataUrl: secretPixels },
        metrics: { logicalPages: 2 }, issues: [{ code: "OVERFLOW", message: "secret rendered value" }]
      }
    }, { realData: true });
    expect(result.observation.visualMode).toBe("geometry");
    expect(result.observation.snapshot.redacted).toBe(true);
    expect(result.observation).not.toHaveProperty("pixelSnapshot");
    expect(JSON.stringify(result)).not.toContain("REAL_DATA_OBSERVATION");
    expect(JSON.stringify(result)).not.toContain("secret rendered value");
  });
});
