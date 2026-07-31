import { AGENT_CONTRACT_VERSION, PROTOCOL_VERSION } from "./constants.js";
import { validateProject } from "./acceptance.js";
import { RevisionHistory, revisionConflict } from "./history.js";
import { applyOperations, diffProjects, previewSourceEdit } from "./operations.js";
import { createScenario, SAMPLE_SCENARIOS } from "./sample-scenarios.js";
import { TOOL_CONTRACTS } from "./tool-contracts.js";
import { PRINT_LOCALES } from "./i18n.js";
import { createLayoutReviewReceipt, layoutReviewStatus, LAYOUT_REVIEW_CHECKLIST } from "./layout-review.js";
import { sha256, stableStringify } from "./json.js";

// In-memory only — a memory-management knob, not a correctness dependency.
// Revision numbers are monotonic and never reused (history.js), so
// ensureRevision() already rejects any write against a base that has since
// moved on; a stale-but-still-cached candidate report can only ever be
// looked up by a hash computed from the CURRENT candidate content, so it
// can't be served against different content either.
const CANDIDATE_REPORT_TTL_MS = 5 * 60 * 1000;

// Shared by validation() (current project vs. its recorded renderReport) and
// getCandidateReport() (a candidate vs. its own cached report) — same merge
// semantics, two different sources for "report".
function mergeRenderReport(base, report) {
  if (!report) return base;
  const unique = (items) => Array.from(new Map(items.map((item) => [`${item.code}:${item.path || "/"}:${item.message}`, item])).values());
  return {
    ...base,
    valid: base.valid && report.status === "ready",
    productionValid: base.productionValid && report.status === "ready",
    errors: unique([...base.errors, ...(report.validation?.errors || [])]),
    warnings: unique([...base.warnings, ...(report.validation?.warnings || [])]),
    metrics: { ...base.metrics, ...(report.metrics || {}) },
    issues: report.issues || []
  };
}

function inspectTemplate(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  const bindings = Array.from(template.content.querySelectorAll("[data-pf-text],[data-pf-each],[data-pf-if],[data-pf-href],[data-pf-i18n],[data-pf-asset-slot]")).map((node) => ({
    tag: node.tagName.toLowerCase(),
    id: node.id || null,
    className: node.className || null,
    text: node.getAttribute("data-pf-text"),
    each: node.getAttribute("data-pf-each"),
    condition: node.getAttribute("data-pf-if"),
    href: node.getAttribute("data-pf-href"),
    i18nKey: node.getAttribute("data-pf-i18n"),
    assetSlot: node.getAttribute("data-pf-asset-slot")
  }));
  return { blocks: template.content.children.length, bindings };
}

export class CommandBus extends EventTarget {
  constructor(initialProject, { renderCandidate } = {}) {
    super();
    this.history = new RevisionHistory(initialProject);
    this.defaultSample = structuredClone(initialProject.sampleData);
    this.renderReport = null;
    this.reviewReceipt = null;
    this.reviewAttempts = 0;
    // Optional DOM-backed renderer injected by the UI layer (app.js), reusing
    // its one visible preview iframe. Unset in every non-browser context
    // (unit tests, the CLI validator) — preview_changes/apply_changes then
    // fall back to today's static-only validation, unchanged.
    this.renderCandidate = renderCandidate || null;
    this.candidateReports = new Map();
  }

  get project() { return this.history.project; }
  get revision() { return this.history.revision; }

  ensureRevision(expected) {
    if (expected !== this.revision) throw revisionConflict(expected, this.revision);
  }

  validation(project = this.project) {
    const base = validateProject(project);
    if (project !== this.project) return base;
    return mergeRenderReport(base, this.renderReport);
  }

  recordRenderReport(report) { this.renderReport = structuredClone(report); }

  // Real pagination for a not-yet-committed candidate, cached by content
  // hash so a preview_changes immediately followed by the identical
  // apply_changes doesn't pay for a second render. Returns null (not a
  // rejected promise) when no renderer is available, so callers can treat
  // "no real report" as a plain fallback rather than an error path.
  async getCandidateReport(candidate, revision) {
    if (!this.renderCandidate) return null;
    const hash = await sha256(stableStringify(candidate));
    const now = Date.now();
    const cached = this.candidateReports.get(hash);
    if (cached && cached.expiresAt > now) return { hash, report: cached.report };
    let report;
    try {
      report = await this.renderCandidate(candidate, revision);
    } catch (error) {
      report = { status: "blocked", validation: { valid: false, errors: [{ code: "RENDER_FAILED", path: "/", message: error?.message || "Candidate render failed" }], warnings: [] }, issues: [], metrics: {} };
    }
    this.candidateReports.set(hash, { report, expiresAt: now + CANDIDATE_REPORT_TTL_MS });
    for (const [key, entry] of this.candidateReports) {
      if (entry.expiresAt <= now) this.candidateReports.delete(key);
    }
    return { hash, report };
  }

  readiness() {
    const base = this.validation();
    const pending = [];
    if (!this.renderReport) pending.push({ code: "PREVIEW_REQUIRED", message: "A current browser layout report is required before production export", path: "/", severity: "error" });
    const review = layoutReviewStatus(this.reviewReceipt, this.revision);
    if (review.status !== "pass") pending.push({ code: "LAYOUT_REVIEW_REQUIRED", message: "A current AI full-page UI/UX review is required before production export", path: "/review", severity: "error" });
    return { ...base, valid: base.valid && !pending.length, productionValid: base.productionValid && !pending.length, errors: [...base.errors, ...pending], reviewReceipt: review.status === "pass" ? this.reviewReceipt : null };
  }

  preview(operations, expectedRevision) {
    this.ensureRevision(expectedRevision);
    const candidate = applyOperations(this.project, operations);
    return { revision: this.revision, diff: diffProjects(this.project, candidate), validation: this.validation(candidate), candidate };
  }

  commit(candidate, reason) {
    this.renderReport = null;
    this.reviewReceipt = null;
    this.reviewAttempts = 0;
    const revision = this.history.commit(candidate, reason);
    this.dispatchEvent(new CustomEvent("change", { detail: { revision, project: candidate, reason } }));
    return revision;
  }

  async execute(name, input = {}) {
    try {
      if (name === "get_capabilities") {
        // candidateHash: the field is always present on preview_changes/
        // apply_changes responses (contract shape). candidateRealRender:
        // whether THIS session can actually back it with real pagination —
        // false in a DOM-less context (CLI validator, unit tests), where
        // both tools fall back to schema-only validation and candidateHash
        // is always null. Additive to 1.1.0, so no existing caller breaks.
        const capabilities = { candidateHash: true, candidateRealRender: Boolean(this.renderCandidate) };
        return this.success({ protocolVersion: PROTOCOL_VERSION, contractVersion: AGENT_CONTRACT_VERSION, capabilities, tools: TOOL_CONTRACTS, sampleScenarios: SAMPLE_SCENARIOS, locales: PRINT_LOCALES, humanExportRequired: true, completionPolicy: "AI layout review must pass for the current revision before request_export can be ready" });
      }
      if (name === "get_project_summary") return this.success({ revision: this.revision, title: this.project.manifest.title, locale: this.project.manifest.locale, trust: this.project.trust, protocolVersion: this.project.manifest.protocolVersion, review: layoutReviewStatus(this.reviewReceipt, this.revision), validation: this.validation() });
      if (name === "inspect_document") return this.success({ revision: this.revision, ...inspectTemplate(this.project.templateHtml) });
      if (name === "validate_project") return this.success({ revision: this.revision, validation: this.validation() });
      if (name === "get_layout_review_status") return this.success({ revision: this.revision, review: layoutReviewStatus(this.reviewReceipt, this.revision), checklist: LAYOUT_REVIEW_CHECKLIST });
      if (name === "begin_layout_review") {
        this.ensureRevision(input.expectedRevision);
        if (this.renderReport?.status !== "ready") throw Object.assign(new Error("Wait for a ready browser preview before starting review"), { code: "LAYOUT_PREVIEW_NOT_READY" });
        this.reviewReceipt = null;
        this.reviewAttempts += 1;
        if (this.reviewAttempts > 3) throw Object.assign(new Error("The three-pass automatic review limit is exhausted for this revision"), { code: "REVIEW_ATTEMPT_LIMIT" });
        return this.success({ revision: this.revision, attempt: this.reviewAttempts, checklist: LAYOUT_REVIEW_CHECKLIST, metrics: this.renderReport.metrics, issues: this.renderReport.issues || [] });
      }
      if (name === "complete_layout_review") {
        this.ensureRevision(input.expectedRevision);
        if (!this.reviewAttempts) throw Object.assign(new Error("begin_layout_review must be called first"), { code: "REVIEW_NOT_STARTED" });
        this.reviewReceipt = createLayoutReviewReceipt(this.revision, this.renderReport, input, this.reviewAttempts);
        this.dispatchEvent(new CustomEvent("review", { detail: { revision: this.revision, review: this.reviewReceipt } }));
        return this.success({ revision: this.revision, review: this.reviewReceipt });
      }
      if (name === "preview_changes") {
        const preview = this.preview(input.operations, input.expectedRevision);
        const candidateReport = await this.getCandidateReport(preview.candidate, preview.revision);
        const validation = candidateReport ? mergeRenderReport(preview.validation, candidateReport.report) : preview.validation;
        return this.success({ revision: preview.revision, diff: preview.diff, validation, candidateHash: candidateReport?.hash || null });
      }
      if (name === "apply_changes") {
        const preview = this.preview(input.operations, input.expectedRevision);
        if (!preview.diff.changed) return this.success({ revision: this.revision, diff: preview.diff, validation: preview.validation, candidateHash: null });
        const candidateReport = await this.getCandidateReport(preview.candidate, preview.revision);
        const validation = candidateReport ? mergeRenderReport(preview.validation, candidateReport.report) : preview.validation;
        const revision = this.commit(preview.candidate, input.reason || "agent change");
        return this.success({ revision, diff: preview.diff, validation, candidateHash: candidateReport?.hash || null });
      }
      if (name === "preview_source_edit") {
        this.ensureRevision(input.expectedRevision);
        const candidate = previewSourceEdit(this.project, input.section, input.content);
        return this.success({ revision: this.revision, diff: diffProjects(this.project, candidate), validation: this.validation(candidate) });
      }
      if (name === "set_sample_scenario") {
        this.ensureRevision(input.expectedRevision);
        const preview = this.preview([{ type: "replace_sample_data", value: createScenario(this.defaultSample, input.scenario) }], input.expectedRevision);
        // No-op re-selection must not bump the revision — that would clear a
        // passing layout review (and burn a limited review attempt) for free.
        const revision = preview.diff.changed ? this.commit(preview.candidate, `sample scenario: ${input.scenario}`) : this.revision;
        return this.success({ revision, validation: preview.validation });
      }
      if (name === "set_locale") {
        if (!PRINT_LOCALES.includes(input.locale)) throw Object.assign(new Error(`Unsupported locale: ${input.locale}`), { code: "LOCALE_UNSUPPORTED" });
        const preview = this.preview([{ type: "set_manifest_value", path: "/locale", value: input.locale }], input.expectedRevision);
        const revision = preview.diff.changed ? this.commit(preview.candidate, `locale: ${input.locale}`) : this.revision;
        return this.success({ revision, locale: input.locale, validation: preview.validation });
      }
      if (name === "set_asset_source") {
        const preview = this.preview([{ type: "set_asset_slot", slot: input.slot, source: input.source }], input.expectedRevision);
        const revision = preview.diff.changed ? this.commit(preview.candidate, `asset slot: ${input.slot}`) : this.revision;
        return this.success({ revision, slot: input.slot, validation: preview.validation });
      }
      if (name === "undo_revision") {
        const result = this.history.undo(input.expectedRevision);
        if (result.changed) {
          this.renderReport = null;
          this.reviewReceipt = null;
          this.reviewAttempts = 0;
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
