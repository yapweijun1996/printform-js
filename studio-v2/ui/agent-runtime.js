import { buildProviderInput, buildRuntimeBudget, validateProviderProfile } from "./agent-provider.js";
import { consumeRuntimeTurn } from "./agent-runtime-consume.js";
import { bindAgentSession } from "../adapters/gateway.js";
import { createProposalApproval } from "./agent-approval.js";
import { makePrintFormActions } from "./agent-actions.js";
import { DESIGNER_PROMPT } from "./agent-designer-prompt.js";
import { LayoutReviewLoop } from "./agent-layout-loop.js";
import { parseTextProposal } from "./agent-proposal-parser.js";
import { createTerminalState } from "./agent-terminal-state.js";
import { READ_ACTIONS, DISABLED_ACTIONS } from "./agent-runtime-constants.js";
import { assertPolicyCurrent, isPolicyCurrent } from "../core/data-policy.js";
import { approvalFrom, outputText } from "./agent-runtime-output.js";
import { executeApplyWithResolution } from "./agent-commit-resolution.js";
import { loadCurrentDesignerSkill } from "./agent-runtime-skills.js";

function clone(value) { return structuredClone(value); }

export class DesignerRuntimeController {
  static async create(options) {
    const agentSkills = await loadCurrentDesignerSkill(options);
    options.assertCurrentContext?.();
    if (options.dataPolicy && options.getDataPolicy) assertPolicyCurrent(options.dataPolicy, options.getDataPolicy());
    return new DesignerRuntimeController({ ...options, agentSkills });
  }

  constructor({ Agrun, gateway, sessionManager, sessionId, profile, maxSteps = 100, existing = false, realData = false, dataPolicy = null, getDataPolicy = null, assertCurrentContext = null, agentSkills = [], onProposal = () => {}, onEvent = () => {}, onCandidateState = () => {} }) {
    if (!Agrun) throw Object.assign(new Error("agrun runtime is unavailable"), { code: "AGRUN_UNAVAILABLE" });
    this.gateway = bindAgentSession(gateway, sessionId);
    this.sessionManager = sessionManager;
    this.sessionId = sessionId;
    this.profileId = profile.id;
    this.maxSteps = maxSteps;
    this.realData = Boolean(realData);
    this.dataPolicy = dataPolicy;
    this.getDataPolicy = getDataPolicy;
    this.assertCurrentContext = assertCurrentContext;
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
      gateway: this.gateway,
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
      ...(budget.maxCostUsd ? { maxCostUsd: budget.maxCostUsd } : {})
    });
    this.sessionPromise = existing ? this.runtime.openSession(sessionId) : this.runtime.createSession({ id: sessionId });
  }
  async session() { return this.sessionPromise; }
  emit(event) { this.onEvent(event); }
  currentDataPolicy() { return this.getDataPolicy ? this.getDataPolicy() : this.dataPolicy; }
  assertCurrentPolicy() {
    this.assertCurrentContext?.();
    const current = this.currentDataPolicy();
    if (this.dataPolicy && (!current || !isPolicyCurrent(this.dataPolicy, current))) {
      throw Object.assign(new Error("The Agent policy changed while this request was running"), { code: "STALE_POLICY_CONTEXT" });
    }
    return current;
  }

  async createProposal(proposal) { if (this.actionFailure) return clone(proposal);
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
  async applyProposal(proposalId, profile = null, { humanApproval = false } = {}) {
    if (this.running) throw Object.assign(new Error("The AI Designer is already running"), { code: "AGENT_BUSY" });
    const proposal = this.proposals.get(proposalId);
    if (!proposal || this.pendingProposal?.proposalId !== proposalId) {
      throw Object.assign(new Error("The proposal must be previewed again."), { code: "PROPOSAL_NOT_FOUND" });
    }
    try {
      await this.approval.verify(proposal.approvalToken, proposalId);
      const executeApproval = humanApproval && this.gateway.executeHuman ? this.gateway.executeHuman.bind(this.gateway) : this.gateway.execute.bind(this.gateway);
      const approved = await executeApproval("approve_transaction", {
        expectedRevision: proposal.revision,
        transactionId: proposal.transactionId,
        expectedCandidateHash: proposal.candidateHash,
        requireValid: true,
      });
      if (!approved.ok) throw Object.assign(new Error(`Approval failed (${approved.error?.code || "APPROVAL_FAILED"}).`), { code: approved.error?.code || "APPROVAL_FAILED" });
      const applied = await executeApplyWithResolution({ gateway: this.gateway, executeApproval, proposal, input: {
        expectedRevision: proposal.revision,
        transactionId: proposal.transactionId,
        expectedCandidateHash: proposal.candidateHash,
        requireValid: true,
        reason: "AI Designer auto-applied proposal"
      }});
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
      if (error.code === "RECOVERY_REQUIRED") { this.onProposal(this.pendingProposal, { status: "recovery", preserveCandidate: false }); this.onCandidateState(false); } else this.clearProposal();
      throw error;
    }
  }
  async applyApprovedProposal(proposalId, profile = null, options = {}) {
    return this.applyProposal(proposalId, profile, options);
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
    return consumeRuntimeTurn(this, { ...input, systemPrompt: DESIGNER_PROMPT });
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
    return this.consume(buildProviderInput(profile, prompt, parts, { dataPolicy: this.assertCurrentPolicy() }));
  }

  async resolveApproval(decision, profile) {
    if (!this.pendingApproval) throw Object.assign(new Error("There is no pending approval"), { code: "NO_PENDING_APPROVAL" });
    const pending = this.pendingApproval;
    this.pendingApproval = null;
    const input = { type: "approval_resolution", decision, resumeToken: pending.resumeToken };
    if (decision === "approve") Object.assign(input, buildProviderInput(profile, "", [], { dataPolicy: this.assertCurrentPolicy() }));
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
    this.actionFailure = Object.assign(new Error("The AI turn was cancelled."), { code: "TURN_CANCELLED" });
    this.clearProposal();
    if (this.abortController) this.abortController.abort();
  }
}

export const AGRUN_DISABLED_ACTIONS = Object.freeze([...DISABLED_ACTIONS]);
