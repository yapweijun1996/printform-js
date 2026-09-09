import { describe, expect, it } from "vitest";
import { executeAgentCommand } from "../../studio-v2/adapters/gateway.js";
import { isAutoApplyEligible } from "../../studio-v2/core/agent-boundary.js";
import { createAgentContext } from "../../studio-v2/core/agent-context.js";
import { CommandBus } from "../../studio-v2/core/command-bus.js";
import { classifySyntheticDocument } from "../../studio-v2/core/data-policy.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";
import { getFormSpec } from "../../studio-v2/core/form-spec.js";

function bus() {
  return new CommandBus(createSalesInvoiceProject(), { dataPolicy: classifySyntheticDocument("scope-fixture") });
}

async function previewInScope(scope, operations) {
  return previewProjectInScope(createSalesInvoiceProject(), scope, operations);
}

async function previewProjectInScope(project, scope, operations) {
  const policy = classifySyntheticDocument("scope-fixture");
  const commandBus = new CommandBus(project, { dataPolicy: policy });
  return executeAgentCommand(commandBus, "preview_changes", { expectedRevision: 0, operations }, {
    dataPolicy: policy,
    scope,
    sessionId: "scope-test-session",
  });
}

describe("Agent scope boundary", () => {
  it("rejects malformed or incomplete scopes instead of broadening to the document", () => {
    expect(() => createAgentContext({ scope: { kind: "unsupported" } })).toThrowError(/outside the active Agent scope/);
    expect(() => createAgentContext({ scope: {} })).toThrowError(/outside the active Agent scope/);
    expect(() => createAgentContext({ scope: { kind: "" } })).toThrowError(/outside the active Agent scope/);
    expect(() => createAgentContext({ scope: { kind: "table" } })).toThrowError(/outside the active Agent scope/);
    expect(() => createAgentContext({ scope: { kind: "component" } })).toThrowError(/outside the active Agent scope/);
  });

  it("returns a safe error when a host supplies an invalid scope", async () => {
    const result = await executeAgentCommand(bus(), "get_project_summary", {}, { scope: { kind: "unsupported" } });
    expect(result).toEqual({ ok: false, error: { code: "SCOPE_VIOLATION", message: "Command failed" } });
  });

  it("rejects an empty Agent operation set before creating a transaction", async () => {
    const policy = classifySyntheticDocument("scope-fixture");
    const commandBus = new CommandBus(createSalesInvoiceProject(), { dataPolicy: policy });
    const result = await executeAgentCommand(commandBus, "preview_changes", { expectedRevision: 0, operations: [] }, {
      dataPolicy: policy,
      scope: { kind: "document" },
      sessionId: "scope-test-session",
    });

    expect(result).toEqual({ ok: false, error: { code: "INVALID_OPERATION_SET", message: "Command failed" } });
    expect(commandBus.transactionStore.listTransactions()).toHaveLength(0);
  });

  it("does not classify empty or malformed changes as auto-apply eligible", () => {
    expect(isAutoApplyEligible({ operations: [] })).toBe(false);
    expect(isAutoApplyEligible({ operations: [null] })).toBe(false);
    expect(isAutoApplyEligible({ operations: [{ type: "set_brand_color", hex: "#123456" }] })).toBe(true);
  });

  it("enforces operation categories and prevents component reassignment across scopes", async () => {
    const component = getFormSpec(createSalesInvoiceProject()).components.find((item) => item.role === "table-header");
    const tableOperation = { type: "set_column_widths", tableSelector: ".prowheader, .prowitem", widths: ["7%", "48%", "11%", "16%", "18%"] };
    const componentOperation = { type: "update_component", componentId: component.id, patch: { keepTogether: true } };
    const repeatOperation = { type: "set_pagination_rule", componentId: component.id, rule: "repeatHeader", value: false };

    expect((await previewInScope({ kind: "table", tableId: "default" }, [tableOperation])).ok).toBe(true);
    expect((await previewInScope({ kind: "table", tableSelector: ".prowheader, .prowitem" }, [tableOperation])).ok).toBe(true);
    expect((await previewInScope({ kind: "component", componentId: component.id }, [componentOperation])).ok).toBe(true);
    expect((await previewInScope({ kind: "table", tableId: "default" }, [repeatOperation])).ok).toBe(true);
    expect((await previewInScope({ kind: "component", componentId: component.id }, [repeatOperation])).ok).toBe(true);
    expect((await previewInScope({ kind: "theme" }, [{ type: "set_font_scale", basePt: 10 }])).error.code).toBe("SCOPE_VIOLATION");
    expect((await previewInScope({ kind: "layout" }, [{ type: "bind_field", componentId: component.id, bindingType: "text", pointer: "/title" }])).error.code).toBe("SCOPE_VIOLATION");
    expect((await previewInScope({ kind: "layout" }, [{ ...componentOperation, patch: { binding: { text: "/title" } } }])).error.code).toBe("SCOPE_VIOLATION");
    expect((await previewInScope({ kind: "table", tableId: "default" }, [{ ...componentOperation, patch: { tableId: "other" } }])).error.code).toBe("SCOPE_VIOLATION");
    expect((await previewInScope({ kind: "component", componentId: component.id }, [{ ...componentOperation, patch: { tableId: "other" } }])).error.code).toBe("SCOPE_VIOLATION");
  });

  it("rejects a selector-only table scope spanning different semantic table IDs", async () => {
    const project = createSalesInvoiceProject();
    project.templateHtml = project.templateHtml.replace(
      '<table class="prowitem pf-grid" data-pf-each="/items">',
      '<table class="prowitem pf-grid" data-pf-table-id="secondary" data-pf-each="/items">',
    );
    const operation = { type: "set_column_widths", tableSelector: ".prowheader, .prowitem", widths: ["7%", "48%", "11%", "16%", "18%"] };
    const policy = classifySyntheticDocument("scope-fixture");
    const commandBus = new CommandBus(project, { dataPolicy: policy });

    const result = await executeAgentCommand(commandBus, "preview_changes", { expectedRevision: 0, operations: [operation] }, {
      dataPolicy: policy,
      scope: { kind: "table", tableSelector: ".prowheader, .prowitem" },
      sessionId: "scope-test-session",
    });

    expect(result).toEqual({ ok: false, error: { code: "SCOPE_VIOLATION", message: "Command failed" } });
    expect(commandBus.transactionStore.listTransactions()).toHaveLength(0);
  });

  it("rejects a mixed allowed and forbidden batch before creating a transaction", async () => {
    const policy = classifySyntheticDocument("mixed-scope-fixture");
    const commandBus = new CommandBus(createSalesInvoiceProject(), { dataPolicy: policy });
    const result = await executeAgentCommand(commandBus, "preview_changes", {
      expectedRevision: 0,
      operations: [
        { type: "set_column_widths", tableSelector: ".prowheader, .prowitem", widths: ["7%", "48%", "11%", "16%", "18%"] },
        { type: "set_brand_color", hex: "#854d0e" }
      ]
    }, { dataPolicy: policy, scope: { kind: "table", tableId: "default" }, sessionId: "mixed-scope-session" });

    expect(result).toEqual({ ok: false, error: { code: "SCOPE_VIOLATION", message: "Command failed" } });
    expect(commandBus.revision).toBe(0);
    expect(commandBus.transactionStore.listTransactions()).toHaveLength(0);
  });
});
