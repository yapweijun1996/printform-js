import { describe, expect, it } from "vitest";
import { validateData } from "../../studio-v2/core/schema.js";
import { getOperationCatalog } from "../../studio-v2/core/operation-catalog.js";
import { inspectDesignState } from "../../studio-v2/core/design-state.js";
import { CommandBus } from "../../studio-v2/core/command-bus.js";
import { executeAgentCommand } from "../../studio-v2/adapters/gateway.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";
import { VAULT_POLICY } from "../../studio-v2/ui/agent-vault.js";
import { inspectColumnGroups } from "../../studio-v2/core/column-inspection.js";
import { buildRuntimeBudget, validateProviderProfile } from "../../studio-v2/ui/agent-provider.js";
import { TOOL_CONTRACTS } from "../../studio-v2/core/tool-contracts.js";

describe("AI Designer contract and safety boundary", () => {
  it("publishes all 13 operation schemas and examples from one validator SSOT", () => {
    const catalog = getOperationCatalog();
    expect(catalog).toHaveLength(13);
    catalog.forEach((entry) => expect(validateData(entry.inputSchema, entry.example).valid, entry.type).toBe(true));
    expect(new Set(catalog.map((entry) => entry.type)).size).toBe(13);
    const preview = TOOL_CONTRACTS.find((tool) => tool.name === "preview_changes");
    const apply = TOOL_CONTRACTS.find((tool) => tool.name === "apply_changes");
    for (const tool of [preview, apply]) {
      const schemas = tool.inputSchema.properties.operations.items.oneOf;
      expect(schemas).toHaveLength(13);
      expect(new Set(schemas.map((schema) => schema.properties.type.const)).size).toBe(13);
    }
  });

  it("returns safe design state without sample values or asset sources", () => {
    const project = createSalesInvoiceProject();
    const state = inspectDesignState({ ...project, revision: 4 });
    const serialized = JSON.stringify(state);
    expect(state.revision).toBe(4);
    expect(state.supportedOperations).toHaveLength(13);
    expect(serialized).not.toContain("USB-C Docking Station");
    expect(serialized).not.toContain("data:image/");
    expect(serialized).not.toContain("Example Business");
    expect(state.assets).toEqual(expect.arrayContaining([expect.objectContaining({ slot: "letterhead-logo", configured: true })]));
  });

  it("redacts business values, rendered text and raw validation messages at the agent gateway", async () => {
    const project = createSalesInvoiceProject();
    project.sampleData.items[0].lineTotal = 987654.32;
    const response = await executeAgentCommand(new CommandBus(project), "validate_project", {});
    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain("987654.32");
    expect(serialized).not.toContain("Line total must equal");
    expect(response.result.validation.errors[0]).not.toHaveProperty("message");
  });

  it("pins approved candidates and rejects invalid candidates without changing revision", async () => {
    const renderer = async () => ({ status: "ready", validation: { errors: [], warnings: [] }, issues: [], metrics: {} });
    const bus = new CommandBus(createSalesInvoiceProject(), { renderCandidate: renderer });
    const preview = await bus.execute("preview_changes", { expectedRevision: 0, operations: [{ type: "set_brand_color", hex: "#123456" }] });
    const mismatch = await bus.execute("apply_changes", { expectedRevision: 0, operations: [{ type: "set_brand_color", hex: "#654321" }], expectedCandidateHash: preview.result.candidateHash, requireValid: true });
    expect(mismatch.error.code).toBe("CANDIDATE_HASH_MISMATCH");
    expect(bus.revision).toBe(0);
    const invalid = await bus.execute("apply_changes", { expectedRevision: 0, operations: [{ type: "replace_template", value: "<div></div>" }], requireValid: true });
    expect(invalid.error.code).toBe("CANDIDATE_INVALID");
    expect(bus.revision).toBe(0);
  });

  it("keeps legacy apply behavior when new safety flags are omitted", async () => {
    const bus = new CommandBus(createSalesInvoiceProject());
    const result = await bus.execute("apply_changes", { expectedRevision: 0, operations: [{ type: "replace_template", value: "<div></div>" }] });
    expect(result.ok).toBe(true);
    expect(bus.revision).toBe(1);
  });

  it("previews and applies every catalog operation through the real command bus", async () => {
    const project = createSalesInvoiceProject();
    const template = document.createElement("template");
    template.innerHTML = project.templateHtml;
    const logo = template.content.querySelector('[data-pf-asset-slot="letterhead-logo"]');
    const columns = inspectColumnGroups(project.templateHtml, project)[0];
    const operations = [
      { type: "set_manifest_value", path: "/title", value: "Agent test invoice" },
      { type: "replace_manifest", value: structuredClone(project.manifest) },
      { type: "replace_schema", value: structuredClone(project.schema) },
      { type: "replace_i18n", value: structuredClone(project.i18n) },
      { type: "replace_sample_data", value: structuredClone(project.sampleData) },
      { type: "replace_theme", value: project.themeCss },
      { type: "replace_template", value: project.templateHtml },
      { type: "set_asset_slot", slot: "letterhead-logo", source: logo.getAttribute("src") },
      { type: "set_text", selector: "h1.pf-brand", value: "Agent Test Company" },
      { type: "set_attribute", selector: "h1.pf-brand", name: "data-agent-test", value: "true" },
      { type: "set_column_widths", tableSelector: columns.tableSelector, widths: columns.columns.map((column) => column.width || "auto") },
      { type: "set_font_scale", basePt: 9.5 },
      { type: "set_brand_color", hex: "#123456" }
    ];
    const bus = new CommandBus(project);
    for (const operation of operations) {
      const expectedRevision = bus.revision;
      const preview = await bus.execute("preview_changes", { expectedRevision, operations: [operation] });
      expect(preview.ok, operation.type).toBe(true);
      const applied = await bus.execute("apply_changes", { expectedRevision, operations: [operation] });
      expect(applied.ok, operation.type).toBe(true);
    }
  });

  it("publishes the browser vault policy without exposing a credential field", () => {
    expect(VAULT_POLICY).toMatchObject({ pbkdf2Iterations: 600000, saltBytes: 16, ivBytes: 12, minPassphraseLength: 12 });
    expect(JSON.stringify(VAULT_POLICY)).not.toContain("apiKey");
  });

  it("enables the USD cap only when both model prices are supplied", () => {
    const base = { provider: "openai", model: "gpt-smoke", apiKey: "memory-only" };
    expect(buildRuntimeBudget(base)).toMatchObject({ priced: false, maxCostUsd: undefined });
    const priced = { ...base, inputPricePer1M: "0.15", outputPricePer1M: "0.60", maxCostUsd: "2" };
    expect(buildRuntimeBudget(priced)).toMatchObject({ priced: true, maxCostUsd: 2, costPricing: { "openai:gpt-smoke": { input: 0.15, output: 0.6, per: 1000000, currency: "USD" } } });
    expect(validateProviderProfile({ ...base, inputPricePer1M: "0.15" })).toContain("both input and output");
    expect(validateProviderProfile({ ...priced, maxCostUsd: "0" })).toContain("greater than zero");
  });
});
