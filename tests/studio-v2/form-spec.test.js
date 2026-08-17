import { describe, expect, it } from "vitest";
import { applyOperations } from "../../studio-v2/core/operations.js";
import { createEmptyProject } from "../../studio-v2/core/project-model.js";
import { createLegacyFormSpec, validateFormSpec } from "../../studio-v2/core/form-spec.js";
import { CommandBus } from "../../studio-v2/core/command-bus.js";

describe("FormSpec compatibility registry", () => {
  it("derives a stable semantic registry from a legacy template", () => {
    const project = createEmptyProject();
    project.templateHtml = '<div class="printform"><div class="pheader">Header</div><div class="prowheader" data-pf-table-id="valuation">Valuation</div><div class="prowitem" data-pf-table-id="valuation">Row</div></div>';
    const spec = createLegacyFormSpec(project);
    expect(spec.mode).toBe("legacy-adapter");
    expect(validateFormSpec(spec).valid).toBe(true);
    expect(spec.components.map((component) => component.id)).toEqual(expect.arrayContaining([
      "document-header-1",
      "table-valuation-header",
      "table-valuation-rows",
    ]));
  });

  it("applies binding and pagination edits through component ids, not arbitrary selectors", () => {
    const project = createEmptyProject();
    project.templateHtml = '<div class="printform"><div class="pheader">Header</div></div>';
    const bound = applyOperations(project, [{
      type: "bind_field", componentId: "document-header-1", bindingType: "text", pointer: "/title",
    }]);
    expect(bound.spec.components[0].binding).toEqual({ text: "/title" });
    expect(bound.templateHtml).toContain('data-pf-text="/title"');

    const paginated = applyOperations(bound, [{
      type: "set_pagination_rule", componentId: "document-header-1", rule: "keepTogether", value: true,
    }]);
    expect(paginated.spec.pagination.rules["document-header-1"]).toEqual({ rule: "keepTogether", value: true });
    expect(paginated.templateHtml).toContain('data-pf-keep-together="true"');
  });

  it("publishes FormSpec through the command bus without exposing sample rows", async () => {
    const bus = new CommandBus(createEmptyProject());
    const result = await bus.execute("get_form_spec");
    expect(result.ok).toBe(true);
    expect(result.result.spec.components.length).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toContain("sample");
  });
});
