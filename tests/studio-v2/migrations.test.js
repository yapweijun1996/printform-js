import { describe, expect, it } from "vitest";
import { analyzeMigration } from "../../studio-v2/core/migrations.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";

describe("PrintForm protocol migrations", () => {
  it("does nothing for the current protocol", () => {
    expect(analyzeMigration(createSalesInvoiceProject()).action).toBe("none");
  });

  it("previews same-major changes and never mutates the source", () => {
    const project = createSalesInvoiceProject();
    project.manifest.protocolVersion = "2.0.0-pre";
    const migration = analyzeMigration(project);
    expect(migration.action).toBe("preview");
    expect(migration.candidate.manifest.protocolVersion).toBe("2.0.0");
    expect(project.manifest.protocolVersion).toBe("2.0.0-pre");
  });

  it("keeps cross-major documents read-only", () => {
    const project = createSalesInvoiceProject();
    project.manifest.protocolVersion = "3.0.0";
    expect(analyzeMigration(project).action).toBe("read-only");
  });
});
