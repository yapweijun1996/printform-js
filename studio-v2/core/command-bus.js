import { AGENT_CONTRACT_VERSION, PROTOCOL_VERSION } from "./constants.js";
import { validateProject } from "./acceptance.js";
import { RevisionHistory, revisionConflict } from "./history.js";
import { applyOperations, diffProjects, previewSourceEdit } from "./operations.js";
import { createScenario, SAMPLE_SCENARIOS } from "./sample-scenarios.js";
import { TOOL_CONTRACTS } from "./tool-contracts.js";

function inspectTemplate(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  const bindings = Array.from(template.content.querySelectorAll("[data-pf-text],[data-pf-each],[data-pf-if],[data-pf-href]")).map((node) => ({
    tag: node.tagName.toLowerCase(),
    id: node.id || null,
    className: node.className || null,
    text: node.getAttribute("data-pf-text"),
    each: node.getAttribute("data-pf-each"),
    condition: node.getAttribute("data-pf-if"),
    href: node.getAttribute("data-pf-href")
  }));
  return { blocks: template.content.children.length, bindings };
}

export class CommandBus extends EventTarget {
  constructor(initialProject) {
    super();
    this.history = new RevisionHistory(initialProject);
    this.defaultSample = structuredClone(initialProject.sampleData);
    this.renderReport = null;
  }

  get project() { return this.history.project; }
  get revision() { return this.history.revision; }

  ensureRevision(expected) {
    if (expected !== this.revision) throw revisionConflict(expected, this.revision);
  }

  validation(project = this.project) {
    const base = validateProject(project);
    if (project !== this.project || !this.renderReport) return base;
    const unique = (items) => Array.from(new Map(items.map((item) => [`${item.code}:${item.path || "/"}:${item.message}`, item])).values());
    return {
      ...base,
      valid: base.valid && this.renderReport.status === "ready",
      productionValid: base.productionValid && this.renderReport.status === "ready",
      errors: unique([...base.errors, ...(this.renderReport.validation?.errors || [])]),
      warnings: unique([...base.warnings, ...(this.renderReport.validation?.warnings || [])]),
      metrics: { ...base.metrics, ...(this.renderReport.metrics || {}) }
    };
  }

  recordRenderReport(report) { this.renderReport = structuredClone(report); }

  readiness() {
    if (this.renderReport) return this.validation();
    const base = this.validation();
    const pending = { code: "PREVIEW_REQUIRED", message: "A current browser layout report is required before production export", path: "/", severity: "error" };
    return { ...base, valid: false, productionValid: false, errors: [...base.errors, pending] };
  }

  preview(operations, expectedRevision) {
    this.ensureRevision(expectedRevision);
    const candidate = applyOperations(this.project, operations);
    return { revision: this.revision, diff: diffProjects(this.project, candidate), validation: this.validation(candidate), candidate };
  }

  commit(candidate, reason) {
    this.renderReport = null;
    const revision = this.history.commit(candidate, reason);
    this.dispatchEvent(new CustomEvent("change", { detail: { revision, project: candidate, reason } }));
    return revision;
  }

  async execute(name, input = {}) {
    try {
      if (name === "get_capabilities") return this.success({ protocolVersion: PROTOCOL_VERSION, contractVersion: AGENT_CONTRACT_VERSION, tools: TOOL_CONTRACTS, sampleScenarios: SAMPLE_SCENARIOS, humanExportRequired: true });
      if (name === "get_project_summary") return this.success({ revision: this.revision, title: this.project.manifest.title, locale: this.project.manifest.locale, trust: this.project.trust, protocolVersion: this.project.manifest.protocolVersion, validation: this.validation() });
      if (name === "inspect_document") return this.success({ revision: this.revision, ...inspectTemplate(this.project.templateHtml) });
      if (name === "validate_project") return this.success({ revision: this.revision, validation: this.validation() });
      if (name === "preview_changes") {
        const preview = this.preview(input.operations, input.expectedRevision);
        return this.success({ revision: preview.revision, diff: preview.diff, validation: preview.validation });
      }
      if (name === "apply_changes") {
        const preview = this.preview(input.operations, input.expectedRevision);
        const revision = preview.diff.changed ? this.commit(preview.candidate, input.reason || "agent change") : this.revision;
        return this.success({ revision, diff: preview.diff, validation: preview.validation });
      }
      if (name === "preview_source_edit") {
        this.ensureRevision(input.expectedRevision);
        const candidate = previewSourceEdit(this.project, input.section, input.content);
        return this.success({ revision: this.revision, diff: diffProjects(this.project, candidate), validation: this.validation(candidate) });
      }
      if (name === "set_sample_scenario") {
        this.ensureRevision(input.expectedRevision);
        const source = input.scenario === "default" ? this.defaultSample : this.project.sampleData;
        const preview = this.preview([{ type: "replace_sample_data", value: createScenario(source, input.scenario) }], input.expectedRevision);
        const revision = this.commit(preview.candidate, `sample scenario: ${input.scenario}`);
        return this.success({ revision, validation: preview.validation });
      }
      if (name === "undo_revision") {
        const result = this.history.undo(input.expectedRevision);
        if (result.changed) {
          this.renderReport = null;
          this.dispatchEvent(new CustomEvent("change", { detail: { revision: result.revision, project: result.project, reason: "undo" } }));
        }
        return this.success(result);
      }
      if (name === "request_export") {
        const validation = this.readiness();
        return this.success({ revision: this.revision, ready: validation.productionValid, validation, requiresUserConfirmation: true });
      }
      throw Object.assign(new Error(`Unknown tool: ${name}`), { code: "UNKNOWN_TOOL" });
    } catch (error) {
      return { ok: false, error: { code: error.code || "COMMAND_FAILED", message: error.message, expectedRevision: error.expectedRevision, actualRevision: error.actualRevision } };
    }
  }

  success(result) { return { ok: true, result }; }
}
