import { buildProviderInput, buildRuntimeBudget, validateProviderProfile } from "./agent-provider.js";
import { consumeRuntimeTurn } from "./agent-runtime-consume.js";
import { createProposalApproval } from "./agent-approval.js";
import { makePrintFormActions } from "./agent-actions.js";
import { DESIGNER_PROMPT } from "./agent-designer-prompt.js";
import { LayoutReviewLoop } from "./agent-layout-loop.js";
import { parseTextProposal } from "./agent-proposal-parser.js";
import { createTerminalState } from "./agent-terminal-state.js";
const READ_ACTIONS = [
  "printform_get_capabilities", "printform_get_project_summary", "printform_inspect_document",
  "printform_inspect_design_state", "printform_get_operation_catalog", "printform_validate_project",
  "printform_preview_brand_color", "printform_preview_changes", "printform_preview_layout_repair",
  "printform_complete_current_layout_review", "printform_report_layout_blocked"
];
const DISABLED_ACTIONS = [
  "web_search", "read_url", "remember", "list_agent_skills", "read_agent_skill", "use_agent_skill",
  "execute_skill_tool", "todo_plan", "todo_advance", "todo_cancel", "todo_run_next", "todo_inspect",
  "workspace_list", "workspace_read", "workspace_write", "workspace_replace", "workspace_propose_patch",
  "workspace_apply_patch", "workspace_insert_after_section", "workspace_remove", "workspace_move",
  "workspace_multi_edit", "workspace_finalize_candidate", "workspace_review_candidate", "workspace_publish_candidate",
  "repo_rg", "repo_read_file", "handoff_to_skill", "spawn_subagent"
];
let designerSkillPromise;

async function loadDesignerSkill(Agrun) {
  if (!Agrun?.parseSkillMarkdown) return [];
  if (!designerSkillPromise) {
    designerSkillPromise = fetch(new URL("../agent-skills/printform-designer.md", import.meta.url))
      .then((response) => {
        if (!response.ok) throw new Error(`Designer skill unavailable (${response.status})`);
        return response.text();
      })
      .then((markdown) => {
        const skill = Agrun.parseSkillMarkdown(markdown);
        return skill ? [skill] : [];
      })
      .catch(() => []);
  }
  return designerSkillPromise;
}
function clone(value) { return structuredClone(value); }

function outputText(result) {
  return result?.output?.text || result?.output?.message || result?.output?.body?.text || result?.output?.body?.message || "";
}
function approvalFrom(result) {
  const output = result?.output || {};
  const pending = output.resumeToken ? output : result?.runState?.pendingApproval;
  if (!pending?.resumeToken) return null;
  return { resumeToken: clone(pending.resumeToken), actionName: pending.actionName || pending.resumeToken.actionName || "printform_apply_approved_proposal", text: pending.text || "Approval is required before applying this proposal." };
}
export class DesignerRuntimeController {
  static async create(options) {
    const agentSkills = await loadDesignerSkill(options.Agrun);
    return new DesignerRuntimeController({ ...options, agentSkills });
  }

  constructor({ Agrun, gateway, sessionManager, sessionId, profile, maxSteps = 100, existing = false, realData = false, agentSkills = [], onProposal = () => {}, onEvent = () => {}, onCandidateState = () => {} }) {
    if (!Agrun) throw Object.assign(new Error("agrun runtime is unavailable"), { code: "AGRUN_UNAVAILABLE" });
    this.gateway = gateway;
    this.sessionManager = sessionManager;
    this.sessionId = sessionId;
    this.profileId = profile.id;
    this.maxSteps = maxSteps;
    this.realData = Boolean(realData);
    this.onEvent = onEvent;
    this.onProposal = onProposal;
    this.onCandidateState = onCandidateState;
    this.proposals = new Map();
    this.approval = createProposalApproval({ sessionId });
    this.abortController = null;
    this.actionFailure = null;
    this.pendingApproval = null;
    this.pendingProposal = null;
    this.appliedRevision = null;
    this.running = false;
    this.turnText = "";
    this.terminalState = createTerminalState();
    this.layoutLoop = new LayoutReviewLoop(this);
    const actions = makePrintFormActions({
      Agrun,
      gateway,
      createProposal: (proposal) => this.createProposal(proposal),
      onFailure: (error) => { this.actionFailure = error; },
      onAction: (event) => {
        if (event?.phase === "completed" && event.ok === true && this.terminalState.noteAction(event)) {
          this.emit({ type: "terminal_state", detail: { state: "terminal_action", actionName: event.name } });
        }
      },
      reviewHooks: {
        guardGeneralPreview: () => this.layoutLoop.guardGeneralPreview(),
        prepareRepair: (input) => this.layoutLoop.prepareRepair(input),
        completeInput: (input) => this.layoutLoop.completeInput(input),
        markComplete: (result) => this.layoutLoop.markComplete(result),
        markBlocked: (input) => this.layoutLoop.markBlocked(input)
      }
    });
    const budget = buildRuntimeBudget(profile);
    this.runtime = Agrun.createRuntime({
      skills: [Agrun.openaiBrowserSkill, Agrun.geminiBrowserSkill], agentSkills, customActions: actions,
      sessionStore: sessionManager.createStore(Agrun, sessionId), globalMemory: { enabled: false },
      disabledActions: DISABLED_ACTIONS, actionPolicy: Object.fromEntries(READ_ACTIONS.map((name) => [name, "allow"])),
      plannerMode: "native_tools", nativeToolsFailurePolicy: "hard_fail",
      approvalSigning: { ttlMs: 15 * 60 * 1000, enforceSessionBinding: true }, maxSteps,
      ...(budget.costPricing ? { costPricing: budget.costPricing } : {}),
      ...(budget.maxCostUsd ? { maxCostUsd: budget.maxCostUsd } : {}),
      systemPrompt: DESIGNER_PROMPT
    });
    this.sessionPromise = existing ? this.runtime.openSession(sessionId) : this.runtime.createSession({ id: sessionId });
  }
  async session() { return this.sessionPromise; }
  emit(event) { this.onEvent(event); }

  async createProposal(proposal) {
    const approvalToken = await this.approval.issue(proposal.proposalId);
    const stored = { ...clone(proposal), approvalToken };
    this.proposals.set(proposal.proposalId, stored);
    this.pendingProposal = clone(proposal);
    this.terminalState.noteProposalReady();
    this.layoutLoop.onProposal(proposal);
    this.onProposal(clone(proposal));
    this.onCandidateState(true);
    return clone(proposal);
  }
  clearProposal() {
    if (this.pendingProposal?.proposalId) this.proposals.delete(this.pendingProposal.proposalId);
    this.pendingProposal = null;
    this.terminalState.clearProposal();
    this.onProposal(null);
    this.onCandidateState(false);
  }
  async applyProposal(proposalId, profile = null) {
    if (this.running) throw Object.assign(new Error("The AI Designer is already running"), { code: "AGENT_BUSY" });
    const proposal = this.proposals.get(proposalId);
    if (!proposal || this.pendingProposal?.proposalId !== proposalId) {
      throw Object.assign(new Error("The proposal must be previewed again."), { code: "PROPOSAL_NOT_FOUND" });
    }
    try {
      await this.approval.verify(proposal.approvalToken, proposalId);
      const approved = await this.gateway.execute("approve_transaction", {
        expectedRevision: proposal.revision,
        transactionId: proposal.transactionId,
        expectedCandidateHash: proposal.candidateHash,
        requireValid: true,
      });
      if (!approved.ok) throw Object.assign(new Error(`Approval failed (${approved.error?.code || "APPROVAL_FAILED"}).`), { code: approved.error?.code || "APPROVAL_FAILED" });
      const applied = await this.gateway.execute("apply_changes", {
        expectedRevision: proposal.revision,
        transactionId: proposal.transactionId,
        expectedCandidateHash: proposal.candidateHash,
        requireValid: true,
        reason: "AI Designer auto-applied proposal"
      });
      if (!applied.ok) throw Object.assign(new Error(`Apply failed (${applied.error?.code || "APPLY_FAILED"}).`), { code: applied.error?.code || "APPLY_FAILED" });
      const validation = await this.gateway.execute("validate_project", {});
      if (!validation.ok) throw Object.assign(new Error(`Validation failed (${validation.error?.code || "VALIDATION_FAILED"}).`), { code: validation.error?.code || "VALIDATION_FAILED" });
      this.proposals.delete(proposalId);
      this.pendingProposal = null;
      this.terminalState.noteApplied();
      this.appliedRevision = applied.result?.revision ?? null;
      const continueReview = Boolean(proposal.review && profile && this.layoutLoop.active);
      this.onProposal(null, { preserveCandidate: continueReview });
      if (!continueReview) this.onCandidateState(false);
      this.emit({ type: "proposal_applied", detail: { revision: this.appliedRevision, validation: validation.result?.validation?.valid !== false ? "valid" : "invalid" } });
      if (continueReview) return { applied, validation, review: await this.layoutLoop.afterApply(profile, this.appliedRevision) };
      return { applied, validation };
    } catch (error) {
      this.layoutLoop.stop("apply_failed");
      this.clearProposal();
      throw error;
    }
  }
  async applyApprovedProposal(proposalId, profile = null) {
    return this.applyProposal(proposalId, profile);
  }
  rejectProposal(proposalId) {
    if (this.pendingProposal?.proposalId !== proposalId) return false;
    if (this.proposals.get(proposalId)?.review) this.layoutLoop.stop("repair_rejected");
    this.clearProposal();
    return true;
  }
  outputText(result) { return outputText(result); }
  approvalFrom(result) { return approvalFrom(result); }
  captureToken(token) {
    const text = typeof token === "string" ? token : token?.text || "";
    if (typeof text === "string") this.turnText += text;
  }
  requireTerminalAction(source = "finalize") {
    if (this.actionFailure) return this.actionFailure;
    const repair = this.terminalState.requestRepair();
    if (repair.ready) return null;
    this.emit({ type: "terminal_action_required", detail: {
      source, attempt: repair.attempt, maxAttempts: repair.maxAttempts,
      status: repair.exhausted ? "blocked" : "pending",
      state: repair.exhausted ? "blocked" : "running"
    } });
    if (!repair.exhausted) return null;
    const error = Object.assign(new Error("The provider did not execute a terminal PrintForm action."), {
      code: "TERMINAL_ACTION_REQUIRED", budget: repair
    });
    this.actionFailure = error;
    this.terminalState.noteBlocked();
    this.abortController?.abort();
    return error;
  }
  async recoverInvalidPlannerOutput(text) {
    const parsed = parseTextProposal(text);
    if (!parsed) {
      this.requireTerminalAction("invalid_planner_output");
      return null;
    }
    const summary = await this.gateway.execute("get_project_summary", {});
    if (!summary.ok) {
      this.actionFailure = Object.assign(new Error("Unable to read the current revision."), { code: summary.error?.code || "PROJECT_SUMMARY_FAILED" });
      this.abortController?.abort();
      return null;
    }
    return {
      type: "action",
      name: "printform_preview_changes",
      args: {
        expectedRevision: parsed.expectedRevision ?? summary.result?.revision,
        operations: clone(parsed.operations)
      }
    };
  }
  beforeFinalize(_runState, context = {}) {
    if (this.terminalState.isTerminalReady() || parseTextProposal(this.turnText)) return null;
    const error = this.requireTerminalAction(context.source || "finalize");
    if (error) return null;
    return { continue: true, observation: "A terminal PrintForm action is required before this design turn can finish." };
  }
  async recoverTextProposal(text) {
    if (this.layoutLoop?.active) return false;
    const parsed = parseTextProposal(text);
    if (!parsed) return false;
    this.layoutLoop.guardGeneralPreview();
    const summary = await this.gateway.execute("get_project_summary", {});
    if (!summary.ok) throw Object.assign(new Error("Unable to read the current revision."), { code: summary.error?.code || "PROJECT_SUMMARY_FAILED" });
    const expectedRevision = parsed.expectedRevision ?? summary.result?.revision;
    const preview = await this.gateway.execute("preview_changes", { expectedRevision, operations: clone(parsed.operations) });
    if (!preview.ok) throw Object.assign(new Error("The text proposal could not be previewed."), { code: preview.error?.code || "PREVIEW_FAILED" });
    const result = preview.result || {};
    await this.createProposal({
      proposalId: crypto.randomUUID(),
      revision: result.revision ?? expectedRevision,
      transactionId: result.transactionId,
      operations: clone(parsed.operations),
      candidateHash: result.candidateHash,
      diff: clone(result.diff),
      validation: clone(result.validation)
    });
    this.emit({ type: "proposal_recovered", detail: { status: "success", operationCount: parsed.operations.length } });
    return true;
  }
  async consume(input) {
    this.actionFailure = null;
    this.turnText = "";
    this.terminalState?.reset();
    return consumeRuntimeTurn(this, input);
  }

  async run(prompt, profile, parts = []) {
    const error = validateProviderProfile(profile);
    if (error) throw Object.assign(new Error(error), { code: "PROVIDER_PROFILE_INVALID" });
    if (this.running) throw Object.assign(new Error("The AI Designer is already running"), { code: "AGENT_BUSY" });
    if (this.pendingApproval) throw Object.assign(new Error("Resolve the pending approval before starting another design turn."), { code: "PENDING_APPROVAL" });
    if (this.pendingProposal) this.clearProposal();
    this.actionFailure = null;
    this.pendingApproval = null;
    this.layoutLoop.stop("new_design_turn");
    return this.consume(buildProviderInput(profile, prompt, parts));
  }

  async resolveApproval(decision, profile) {
    if (!this.pendingApproval) throw Object.assign(new Error("There is no pending approval"), { code: "NO_PENDING_APPROVAL" });
    const pending = this.pendingApproval;
    this.pendingApproval = null;
    const input = { type: "approval_resolution", decision, resumeToken: pending.resumeToken };
    if (decision === "approve") Object.assign(input, buildProviderInput(profile, ""));
    const outcome = await this.consume(input);
    if (decision === "deny") this.pendingProposal = null;
    return outcome;
  }

  async reviewLayout(profile) {
    const error = validateProviderProfile(profile);
    if (error) throw Object.assign(new Error(error), { code: "PROVIDER_PROFILE_INVALID" });
    if (this.running) throw Object.assign(new Error("The AI Designer is already running"), { code: "AGENT_BUSY" });
    if (this.pendingApproval) throw Object.assign(new Error("Resolve the pending approval before starting a layout review."), { code: "PENDING_APPROVAL" });
    if (this.pendingProposal) this.clearProposal();
    this.pendingApproval = null;
    this.appliedRevision = null;
    this.layoutLoop.start();
    try { return await this.layoutLoop.runPass(profile); }
    catch (error) { this.layoutLoop.stop("review_failed"); this.onCandidateState(false); throw error; }
  }

  stop() {
    this.layoutLoop.stop("user_stop");
    this.terminalState.noteStopped();
    this.clearProposal();
    if (this.abortController) this.abortController.abort();
  }
}

export const AGRUN_DISABLED_ACTIONS = Object.freeze([...DISABLED_ACTIONS]);
