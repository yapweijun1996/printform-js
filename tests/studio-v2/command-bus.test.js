import { describe, expect, it } from "vitest";
import { CommandBus } from "../../studio-v2/core/command-bus.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";
import { executeAgentCommand } from "../../studio-v2/adapters/gateway.js";

describe("PrintForm Studio v2 command bus", () => {
  it("previews atomically and rejects stale revisions", async () => {
    const bus = new CommandBus(createSalesInvoiceProject());
    const operations = [{ type: "set_manifest_value", path: "/title", value: "Revised invoice" }];
    const preview = await bus.execute("preview_changes", { expectedRevision: 0, operations });
    expect(preview.ok).toBe(true);
    expect(bus.revision).toBe(0);
    const applied = await bus.execute("apply_changes", { expectedRevision: 0, operations });
    expect(applied.result.revision).toBe(1);
    expect(bus.project.manifest.title).toBe("Revised invoice");
    const stale = await bus.execute("apply_changes", { expectedRevision: 0, operations });
    expect(stale.error.code).toBe("REVISION_CONFLICT");
  });

  it("never exposes sample row values in summary or inspection", async () => {
    const bus = new CommandBus(createSalesInvoiceProject());
    const summary = await bus.execute("get_project_summary");
    const inspection = await bus.execute("inspect_document");
    expect(JSON.stringify(summary)).not.toContain("USB-C Docking Station");
    expect(JSON.stringify(inspection)).not.toContain("Example Business");
  });

  it("supports generated boundary samples and undo", async () => {
    const bus = new CommandBus(createSalesInvoiceProject());
    const changed = await bus.execute("set_sample_scenario", { expectedRevision: 0, scenario: "500-rows" });
    expect(changed.ok).toBe(true);
    expect(bus.project.sampleData.items).toHaveLength(500);
    await bus.execute("undo_revision", { expectedRevision: 1 });
    expect(bus.project.sampleData.items).toHaveLength(45);
  });

  it("builds every scenario from the immutable default sample", async () => {
    const bus = new CommandBus(createSalesInvoiceProject());
    expect((await bus.execute("set_sample_scenario", { expectedRevision: 0, scenario: "empty" })).result.validation.valid).toBe(false);
    const one = await bus.execute("set_sample_scenario", { expectedRevision: 1, scenario: "one" });
    expect(one.result.validation.valid).toBe(true);
    expect(bus.project.sampleData.items).toHaveLength(1);
    expect(bus.project.sampleData.items[0]).toHaveProperty("unitPrice");
  });

  it("keeps agent mutations read-only for untrusted projects", async () => {
    const project = createSalesInvoiceProject();
    project.trust = "untrusted";
    const bus = new CommandBus(project);
    const result = await executeAgentCommand(bus, "apply_changes", { expectedRevision: 0, operations: [{ type: "set_manifest_value", path: "/title", value: "blocked" }] });
    expect(result.error.code).toBe("UNTRUSTED_READ_ONLY");
    expect(bus.revision).toBe(0);
  });

  it("does not bump the revision (or void a passing layout review) when re-selecting the same scenario", async () => {
    // Regression: set_sample_scenario used to commit unconditionally, so
    // re-picking the scenario already active was a no-op edit that still
    // cleared renderReport/reviewReceipt — silently burning one of the
    // three-attempt layout review budget for zero content change.
    const bus = new CommandBus(createSalesInvoiceProject());
    const first = await bus.execute("set_sample_scenario", { expectedRevision: 0, scenario: "one" });
    expect(first.result.revision).toBe(1);
    const again = await bus.execute("set_sample_scenario", { expectedRevision: 1, scenario: "one" });
    expect(again.ok).toBe(true);
    expect(again.result.revision).toBe(1);
    expect(bus.revision).toBe(1);
  });

  it("requires the current browser layout report before production export", async () => {
    const bus = new CommandBus(createSalesInvoiceProject());
    let request = await bus.execute("request_export");
    expect(request.result.ready).toBe(false);
    expect(request.result.validation.errors.some((item) => item.code === "PREVIEW_REQUIRED")).toBe(true);
    bus.recordRenderReport({ status: "ready", validation: { errors: [], warnings: [] }, metrics: { logicalPages: 3 } });
    await bus.execute("begin_layout_review", { expectedRevision: 0 });
    const review = await bus.execute("complete_layout_review", {
      expectedRevision: 0, reviewer: "ai-agent", browser: "Chromium test",
      scenarios: ["default", "long-text"], evidence: ["full-page-screenshot", "layout-metrics"],
      findings: [], summary: "No visual issues"
    });
    expect(review.ok).toBe(true);
    request = await bus.execute("request_export");
    expect(request.result.ready).toBe(true);
    expect(request.result.validation.metrics.logicalPages).toBe(3);
  });
});
