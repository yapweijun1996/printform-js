import { describe, expect, it } from "vitest";
import { CommandBus } from "../../studio-v2/core/command-bus.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";

const readyReport = { status: "ready", validation: { errors: [], warnings: [] }, metrics: { logicalPages: 3, overflowElements: 0, verticalOverflowPages: 0, contrastFailures: 0 } };
const evidence = {
  expectedRevision: 0, reviewer: "ai-agent", browser: "Chromium 150",
  scenarios: ["default", "long-text"], evidence: ["full-page-screenshot", "layout-metrics"],
  findings: [], summary: "Hierarchy, pagination, logos and totals reviewed"
};

describe("revision-bound AI layout review", () => {
  it("passes only with visual evidence and becomes stale after a change", async () => {
    const bus = new CommandBus(createSalesInvoiceProject());
    bus.recordRenderReport(readyReport);
    expect((await bus.execute("request_export")).result.ready).toBe(false);
    await bus.execute("begin_layout_review", { expectedRevision: 0 });
    expect((await bus.execute("complete_layout_review", evidence)).ok).toBe(true);
    expect((await bus.execute("request_export")).result.ready).toBe(true);
    await bus.execute("apply_changes", { expectedRevision: 0, operations: [{ type: "set_manifest_value", path: "/title", value: "Changed" }] });
    expect((await bus.execute("request_export")).result.validation.errors).toContainEqual(expect.objectContaining({ code: "LAYOUT_REVIEW_REQUIRED" }));
  });

  it("rejects open major findings", async () => {
    const bus = new CommandBus(createSalesInvoiceProject());
    bus.recordRenderReport(readyReport);
    await bus.execute("begin_layout_review", { expectedRevision: 0 });
    const result = await bus.execute("complete_layout_review", { ...evidence, findings: [{ code: "SPARSE_PAGE", severity: "major", status: "open", message: "Totals are isolated" }] });
    expect(result.error.code).toBe("REVIEW_ISSUES_OPEN");
  });
});
