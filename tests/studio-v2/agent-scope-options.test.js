import { describe, expect, it } from "vitest";
import { getAgentScopeOptions } from "../../studio-v2/core/agent-scope-options.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";

describe("Agent scope options", () => {
  it("derives a stable table scope from the canonical FormSpec", () => {
    const options = getAgentScopeOptions(createSalesInvoiceProject());
    const table = options.find((option) => option.scope.kind === "table");
    expect(table).toMatchObject({ value: "table", scope: { kind: "table", tableId: "default" } });
  });

  it("derives component scopes from stable FormSpec ids without using labels as authority", () => {
    const options = getAgentScopeOptions(createSalesInvoiceProject());
    const component = options.find((option) => option.scope.kind === "component");
    expect(component).toMatchObject({
      value: `component:${component.scope.componentId}`,
      scope: { componentId: expect.any(String) },
    });
    expect(component.selection).toContain(component.scope.componentId);
    expect(options.filter((option) => option.scope.kind === "component")).toHaveLength(
      new Set(options.filter((option) => option.scope.kind === "component").map((option) => option.scope.componentId)).size,
    );
  });
});
