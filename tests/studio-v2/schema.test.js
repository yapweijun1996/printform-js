import { describe, expect, it } from "vitest";
import { validateData, validateSchemaProfile } from "../../studio-v2/core/schema.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";

describe("PrintForm v2 JSON Schema profile", () => {
  it("accepts the production invoice fixture", () => {
    const project = createSalesInvoiceProject();
    expect(validateSchemaProfile(project.schema).valid).toBe(true);
    expect(validateData(project.schema, project.sampleData).valid).toBe(true);
  });

  it("rejects unsupported keywords instead of ignoring them", () => {
    const report = validateSchemaProfile({ type: "string", allOf: [] });
    expect(report.valid).toBe(false);
    expect(report.errors[0].code).toBe("UNSUPPORTED_SCHEMA_KEYWORD");
  });

  it("reports required, type and additional property errors", () => {
    const schema = { type: "object", required: ["count"], properties: { count: { type: "integer" } }, additionalProperties: false };
    expect(validateData(schema, { extra: true }).errors.map((item) => item.code)).toEqual(["REQUIRED", "ADDITIONAL_PROPERTY"]);
    expect(validateData(schema, { count: 1.5 }).errors[0].code).toBe("TYPE_MISMATCH");
  });
});
