import { stableStringify } from "../core/json.js";
import { prepareVisualReviewEvidence } from "../core/visual-regression.js";
import { buildProviderInput } from "./agent-provider.js";

export const MAX_LAYOUT_REVIEW_PASSES = 3;
const FALLBACK_SCENARIOS = ["default", "long-text"];
const SEVERITIES = new Set(["critical", "major", "minor", "info"]);
const STATUSES = new Set(["open", "fixed", "accepted"]);

function fail(code, message) {
  throw Object.assign(new Error(message), { code });
}

function text(value, fallback = "") {
  const result = String(value || "").trim();
  return (result || fallback).slice(0, 500);
}

function normalizeFindings(items, defaultStatus = "open") {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 24).map((item, index) => ({
    code: text(item?.code, `LAYOUT_FINDING_${index + 1}`).replace(/[^A-Z0-9_-]/gi, "_").toUpperCase(),
    severity: SEVERITIES.has(item?.severity) ? item.severity : "minor",
    status: STATUSES.has(item?.status) ? item.status : defaultStatus,
    message: text(item?.message, "Layout issue identified")
  }));
}

function commandError(response, fallbackCode, fallbackMessage) {
  if (response?.ok) return response.result;
  return fail(response?.error?.code || fallbackCode, fallbackMessage);
}

function safeResult(response) {
  return response?.ok ? response.result : null;
}

function buildReviewPrompt(state, collected) {
  const finalPass = state.pass >= state.maxPasses;
  return `You are running PrintForm's bounded multimodal layout review pass ${state.pass}/${state.maxPasses}.
Inspect every attached image and the safe metadata below. Pixel images exist only for synthetic data; geometry images never contain document text or asset pixels.
Choose exactly one terminal PrintForm action and do not return a conversational answer:
1. If a repair is needed and this is not the final pass, call printform_preview_layout_repair once with complete semantic operations, structured findings and a safe summary. Do not call generic preview actions.
2. If every required scenario has an evidenceId and no critical or major issue remains, call printform_complete_current_layout_review once. The host supplies revision and evidence IDs.
3. If a blocking issue remains on the final pass, no safe semantic repair exists, or evidence cannot become reviewable, call printform_report_layout_blocked once.
Never apply changes or request export. The host owns automatic Apply, fresh evidence capture and export-readiness checks.
Review clipping, overlap, overflow, readability, hierarchy, spacing, table balance, repeated areas, totals grouping, asset proportions, contrast and long-text pagination.
Safe review context: ${JSON.stringify({
    pass: state.pass,
    finalPass,
    revision: collected.expectedRevision,
    evidence: collected.context,
    checklist: collected.begun.checklist,
    designState: collected.designState,
    operations: collected.operationCatalog
  })}`;
}

export class LayoutReviewLoop {
  constructor(controller) {
    this.controller = controller;
    this.baselines = new Map();
    this.state = null;
  }

  get active() { return Boolean(this.state?.active); }

  start() {
    this.baselines.clear();
    this.state = {
      active: true, pass: 1, maxPasses: MAX_LAYOUT_REVIEW_PASSES,
      expectedRevision: null, evidenceIds: [], repairSignatures: new Set(),
      pendingRepair: null, completed: null, blocked: null
    };
    this.controller.emit({ type: "layout_review_started", detail: { pass: 1, maxPasses: MAX_LAYOUT_REVIEW_PASSES } });
  }

  stop(reason = "stopped") {
    if (this.state?.active) this.controller.emit({ type: "layout_review_stopped", detail: { reason, pass: this.state.pass } });
    if (this.state) this.state.active = false;
  }

  guardGeneralPreview() {
    if (this.active) fail("LAYOUT_REPAIR_ACTION_REQUIRED", "Use the dedicated layout repair action during visual review");
  }

  prepareRepair({ operations, findings, summary }) {
    const state = this.state;
    if (!state?.active) fail("LAYOUT_REVIEW_NOT_ACTIVE", "No multimodal layout review is active");
    if (state.pass >= state.maxPasses) fail("AUTO_REPAIR_LIMIT_REACHED", "The final review pass cannot create another repair");
    const normalizedFindings = normalizeFindings(findings);
    if (!normalizedFindings.length) fail("LAYOUT_FINDINGS_REQUIRED", "A repair proposal must identify at least one visual finding");
    const signature = stableStringify(operations || []);
    if (state.repairSignatures.has(signature)) fail("REPEATED_LAYOUT_REPAIR", "The same layout repair was already attempted");
    return {
      expectedRevision: state.expectedRevision,
      proposalMeta: { review: { pass: state.pass, findings: normalizedFindings, summary: text(summary, "Layout repair proposed"), signature } }
    };
  }

  onProposal(proposal) {
    const review = proposal?.review;
    if (!review || !this.active) return;
    this.state.repairSignatures.add(review.signature);
    this.state.pendingRepair = structuredClone(review);
    this.controller.emit({
      type: "layout_repair_proposed",
      detail: { pass: review.pass, findingCount: review.findings.length, operationCount: proposal.operations.length, findings: review.findings }
    });
  }

  completeInput({ findings, summary }) {
    const state = this.state;
    if (!state?.active) fail("LAYOUT_REVIEW_NOT_ACTIVE", "No multimodal layout review is active");
    if (state.evidenceIds.length !== state.requiredScenarioCount) fail("REVIEW_SCENARIOS_REQUIRED", "Every required scenario needs a clean evidence receipt");
    return {
      expectedRevision: state.expectedRevision,
      reviewer: "ai-agent",
      evidenceIds: [...state.evidenceIds],
      findings: normalizeFindings(findings),
      summary: text(summary, "Multimodal layout review passed")
    };
  }

  markComplete(result) {
    if (!this.active) return;
    this.state.completed = structuredClone(result);
    this.controller.emit({ type: "layout_review_passed", detail: { pass: this.state.pass, revision: this.state.expectedRevision } });
  }

  markBlocked({ findings, summary }) {
    if (!this.active) fail("LAYOUT_REVIEW_NOT_ACTIVE", "No multimodal layout review is active");
    this.state.blocked = { findings: normalizeFindings(findings), summary: text(summary, "Layout review remains blocked") };
    this.controller.emit({ type: "layout_review_blocked", detail: { pass: this.state.pass, ...structuredClone(this.state.blocked) } });
    return structuredClone(this.state.blocked);
  }

  async collectEvidence() {
    const summary = commandError(await this.controller.gateway.execute("get_project_summary"), "PROJECT_SUMMARY_FAILED", "Unable to read the current revision");
    const expectedRevision = summary.revision;
    const begun = commandError(await this.controller.gateway.execute("begin_layout_review", { expectedRevision }), "REVIEW_START_FAILED", "The committed preview is not ready for review");
    const captures = [];
    for (const scenario of begun.requiredScenarios || FALLBACK_SCENARIOS) {
      const requestedMode = this.controller.realData ? "geometry" : "pixels";
      let result = await this.controller.gateway.execute("capture_layout_evidence", { expectedRevision, scenario, visualMode: requestedMode });
      const pixelUnavailable = result.ok ? /^PIXEL_CAPTURE_/.test(result.result?.pixelCapture?.code || "") : /^PIXEL_CAPTURE_/.test(result.error?.code || "");
      if (requestedMode === "pixels" && pixelUnavailable) result = await this.controller.gateway.execute("capture_layout_evidence", { expectedRevision, scenario, visualMode: "geometry" });
      const captured = commandError(result, "EVIDENCE_CAPTURE_FAILED", `Unable to capture ${scenario} evidence`);
      if (!captured.evidence && !captured.observation) fail("LAYOUT_OBSERVATION_UNAVAILABLE", `Scenario ${scenario} returned no reviewable visual observation`);
      captures.push(captured);
    }
    const designState = safeResult(await this.controller.gateway.execute("inspect_design_state"));
    const operationCatalog = safeResult(await this.controller.gateway.execute("get_operation_catalog"))?.operations || [];
    const prepared = prepareVisualReviewEvidence(captures, this.baselines);
    Object.assign(this.state, {
      expectedRevision,
      evidenceIds: captures.flatMap((item) => item.evidence?.evidenceId ? [item.evidence.evidenceId] : []),
      requiredScenarioCount: (begun.requiredScenarios || FALLBACK_SCENARIOS).length,
      pendingRepair: null,
      completed: null,
      blocked: null
    });
    this.controller.emit({ type: "layout_evidence_ready", detail: { pass: this.state.pass, scenarios: prepared.context } });
    return { expectedRevision, begun, captures, designState, operationCatalog, ...prepared };
  }

  async runPass(profile) {
    const collected = await this.collectEvidence();
    this.controller.emit({ type: "layout_multimodal_started", detail: { pass: this.state.pass, imageCount: collected.parts.length } });
    const outcome = await this.controller.consume(buildProviderInput(profile, buildReviewPrompt(this.state, collected), collected.parts));
    if (outcome?.completed?.terminalKind === "abort") {
      this.controller.onCandidateState(false);
      return { ...outcome, evidence: collected.context, readiness: null, stopped: true };
    }
    if (this.state.completed) {
      const readiness = await this.controller.gateway.execute("request_export", {});
      this.controller.emit({ type: "layout_readiness", detail: readiness });
      this.state.active = false;
      this.controller.onCandidateState(false);
      return { ...outcome, evidence: collected.context, readiness };
    }
    if (this.state.blocked) {
      this.state.active = false;
      this.controller.onCandidateState(false);
      return { ...outcome, evidence: collected.context, blocked: structuredClone(this.state.blocked), readiness: null };
    }
    if (this.controller.pendingProposal || outcome.completed?.terminalKind === "error") return { ...outcome, evidence: collected.context, readiness: null };
    const error = Object.assign(new Error("The multimodal model did not choose a terminal review action"), { code: "LAYOUT_REVIEW_DECISION_REQUIRED" });
    this.controller.emit({ type: "runtime_error", detail: { code: error.code, message: error.message } });
    return { ...outcome, completed: { terminalKind: "error", error }, evidence: collected.context, readiness: null, errorReported: true };
  }

  async afterApply(profile, revision) {
    if (!this.active || !this.state.pendingRepair) return null;
    this.controller.emit({ type: "layout_repair_applied", detail: { pass: this.state.pass, revision } });
    this.state.pass += 1;
    return this.runPass(profile);
  }
}
