import { describe, expect, it } from "vitest";
import { getAgentScopeOptions } from "../../studio-v2/core/agent-scope-options.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";

describe("Agent scope options", () => {
  it("derives a stable table scope from the canonical FormSpec", () => {
    const options = getAgentScopeOptions(createSalesInvoiceProject());
    const table = options.find((option) => option.scope.kind === "table");
    expect(table).toMatchObject({ value: "table", scope: { kind: "table", tableId: "default" } });
  });
});
