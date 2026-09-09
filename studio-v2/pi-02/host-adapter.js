import { AgentHarness, BACKGROUND_CONTEXT, MemorySessionRepo } from "@earendil-works/pi-agent-core";
import { createProposalApproval } from "../ui/agent-approval.js";
import { executeApplyWithResolution, resolvePostCommitValidation } from "../ui/agent-commit-resolution.js";
import { createTurnGuard } from "../ui/agent-budget.js";
import { createTerminalState } from "../ui/agent-terminal-state.js";
import { attachHarnessEventProjection, normalizeHarnessUsage } from "./harness-events.js";
import { createPiPrintFormTools } from "./harness-tools.js";

const CONTEXT = BACKGROUND_CONTEXT;

function clone(value) { return structuredClone(value); }

function errorWithCode(code, message) { return Object.assign(new Error(message), { code }); }

function publicProposal(proposal) {
  if (!proposal) return null;
  return {
    proposalId: proposal.proposalId, revision: proposal.revision,
    transactionId: proposal.transactionId, candidateHash: proposal.candidateHash,
    operationCount: Array.isArray(proposal.operations) ? proposal.operations.length : 0,
    review: Boolean(proposal.review)
  };
}

function publicRun(result, terminal, guardError, fallbackErrorCode = "HARNESS_RUN_FAILED") {
  const value = result?.ok ? result.value : null;
  return {
    ok: Boolean(result?.ok) && !guardError,
    status: result?.ok ? value?.status || "completed" : "failed",
    terminal: terminal.snapshot(),
    ...(guardError ? { error: { code: guardError.code } } : result?.ok ? {} : { error: { code: result?.error?.code || fallbackErrorCode } })
  };
}

export async function createPiHostAdapter({
  models, model, gateway, privateGateway, sessionId = "pi02-session", laneName = "main",
  systemPrompt = "Use the PrintForm tools and stop after one terminal action.", budget = {}, reviewHooks = {}, onEvent,
  sessionRepo: injectedSessionRepo = null, session: injectedSession = null
} = {}) {
  if (!models || !model || !gateway || !privateGateway) throw new Error("PI-02 host adapter dependencies are incomplete.");
  const sessionRepo = injectedSessionRepo || new MemorySessionRepo();
  const session = injectedSession || await sessionRepo.create({}, CONTEXT);
  const terminal = createTerminalState();
  const approval = createProposalApproval({ sessionId });
  const proposals = new Map();
  const events = [];
  const rawTypes = new Set();
  let currentGuard = null;
  let lastGuard = null;
  let lastToolError = null;
  let lastHarnessError = null;
  let terminalSeen = false;
  let blockedAfterTerminal = false;
  let running = false;
  let disposed = false;
  let lastRun = null;

  const emit = (event) => {
    const safe = clone(event);
    events.push(safe);
    onEvent?.(safe);
  };
  const createProposal = async (proposal) => {
    const stored = { ...clone(proposal), approvalToken: await approval.issue(proposal.proposalId) };
    proposals.set(proposal.proposalId, stored);
    terminal.noteProposalReady();
    emit({ type: "proposal_ready", detail: { revision: stored.revision, proposalId: stored.proposalId } });
    return publicProposal(stored);
  };
  const tools = createPiPrintFormTools({ gateway, createProposal, reviewHooks, onFailure: (error) => { lastToolError = error; } });
  const created = await AgentHarness.create({
    session, models, model, tools, activeToolNames: tools.map((tool) => tool.name),
    systemPrompt, toolExecution: "sequential"
  }, CONTEXT);
  const harness = created.harness;
  const lane = await harness.lane(laneName, CONTEXT);

  const offProjection = attachHarnessEventProjection(harness, (projected, raw) => {
    if (projected.type === "runtime_error") lastHarnessError = projected.detail.code;
    if (raw.type === "usage") currentGuard?.observe({ type: "usage", usage: normalizeHarnessUsage(raw.row?.usage ?? raw.usage ?? raw.totals) });
    if (raw.type === "turn_end" && raw.message?.usage) currentGuard?.observe({ type: "usage", usage: normalizeHarnessUsage(raw.message.usage) });
    if (projected.type === "completed") {
      projected.detail.terminalKind = currentGuard?.error ? "error" : terminalSeen ? "done" : projected.detail.terminalKind;
    }
    emit(projected);
  }, rawTypes);
  const offBeforeTool = harness.hooks.on("before_tool", async (event) => {
    if (disposed) return { block: { reason: "PI_RUNTIME_DISPOSED", terminate: true } };
    if (terminalSeen) {
      blockedAfterTerminal = true;
      return { block: { reason: "TERMINAL_ACTION_ALREADY_COMPLETED", terminate: true } };
    }
    const guardError = currentGuard?.observe({ type: "tool_start", detail: { actionName: event.toolName, args: event.args } });
    if (guardError) {
      emit({ type: "budget_warning", detail: { code: guardError.code } });
      return { block: { reason: guardError.code, terminate: true } };
    }
    return undefined;
  });
  const offAfterTool = harness.hooks.on("after_tool", async (event) => {
    const details = event.details && typeof event.details === "object" ? event.details : {};
    const terminalResult = !event.isError && (details.terminal === true || details.control === "complete");
    if (terminalResult) {
      terminalSeen = true;
      terminal.noteAction({ name: event.toolName, control: "complete", phase: "completed", ok: true });
      emit({ type: "terminal_state", detail: { state: "terminal_action", actionName: event.toolName } });
      return { terminate: true };
    }
    if (event.isError) return { terminate: true };
    if (currentGuard?.error) return { terminate: true };
    return undefined;
  });

  async function run(prompt) {
    if (disposed) throw errorWithCode("PI_RUNTIME_DISPOSED", "The PI-02 host adapter is disposed.");
    if (running) throw errorWithCode("AGENT_BUSY", "The PI-02 host adapter is already running.");
    running = true;
    terminal.reset();
    terminalSeen = false;
    blockedAfterTerminal = false;
    lastToolError = null;
    lastHarnessError = null;
    currentGuard = createTurnGuard(budget);
    let result;
    try { result = await lane.prompt(String(prompt || ""), CONTEXT); }
    catch (error) { result = { ok: false, error }; }
    const guardError = currentGuard.error;
    lastGuard = currentGuard.snapshot();
    if (guardError) {
      terminal.noteBlocked();
      lastRun = publicRun(result, terminal, guardError);
    } else if (!terminalSeen && lastToolError) {
      terminal.noteBlocked();
      emit({ type: "runtime_error", detail: { code: lastToolError.code } });
      lastRun = { ...publicRun(result, terminal, null), ok: false, error: { code: lastToolError.code } };
    } else if (!terminalSeen && !result?.ok && result?.error) {
      terminal.noteBlocked();
      const errorCode = result.error.code || lastHarnessError || "HARNESS_RUN_FAILED";
      if (!lastHarnessError) emit({ type: "runtime_error", detail: { code: errorCode } });
      lastRun = publicRun(result, terminal, null, errorCode);
    } else if (!terminalSeen) {
      terminal.noteBlocked();
      emit({ type: "terminal_action_required", detail: { code: "TERMINAL_ACTION_REQUIRED" } });
      lastRun = { ...publicRun(result, terminal, null), ok: false, error: { code: "TERMINAL_ACTION_REQUIRED" } };
    } else {
      lastRun = publicRun(result, terminal, null);
    }
    currentGuard = null;
    running = false;
    return clone(lastRun);
  }

  async function applyPendingProposal(proposalId = [...proposals.keys()][0]) {
    if (disposed) throw errorWithCode("PI_RUNTIME_DISPOSED", "The PI-02 host adapter is disposed.");
    const proposal = proposals.get(proposalId);
    if (!proposal) throw errorWithCode("PROPOSAL_NOT_FOUND", "The proposal must be previewed again.");
    try {
      await approval.verify(proposal.approvalToken, proposalId);
      const executeApproval = privateGateway.executeHuman?.bind(privateGateway);
      if (!executeApproval) throw errorWithCode("HUMAN_APPROVAL_REQUIRED", "Private human approval is unavailable.");
      const approved = await executeApproval("approve_transaction", {
        expectedRevision: proposal.revision, transactionId: proposal.transactionId,
        expectedCandidateHash: proposal.candidateHash, requireValid: true
      });
      if (!approved?.ok) throw errorWithCode(approved?.error?.code || "APPROVAL_FAILED", "Approval failed.");
      const applied = await executeApplyWithResolution({
        gateway: privateGateway, executeApproval, proposal,
        input: { expectedRevision: proposal.revision, transactionId: proposal.transactionId, expectedCandidateHash: proposal.candidateHash, requireValid: true, reason: "PI-02 qualification apply" }
      });
      const postCommit = await resolvePostCommitValidation({ gateway: privateGateway, proposal, applied });
      proposals.delete(proposalId);
      terminal.noteApplied();
      emit({ type: "proposal_applied", detail: { revision: postCommit.applied.result?.revision ?? null, validation: postCommit.unavailable ? "unavailable" : "valid" } });
      return { ok: true, revision: postCommit.applied.result?.revision ?? null, alreadyCommitted: Boolean(postCommit.applied.result?.already_committed), validationUnavailable: Boolean(postCommit.unavailable) };
    } catch (error) {
      if (error?.code !== "RECOVERY_REQUIRED") proposals.delete(proposalId);
      throw error;
    }
  }

  async function dispose() {
    if (disposed) return;
    disposed = true;
    offBeforeTool(); offAfterTool(); offProjection();
    await harness.close(CONTEXT);
    proposals.clear();
  }

  return Object.freeze({
    tools, lane, sessionRepo, harness, run, applyPendingProposal, dispose,
    events: () => clone(events), rawTypes: () => [...rawTypes],
    proposals: () => [...proposals.values()].map(publicProposal),
    state: () => ({ terminal: terminal.snapshot(), blockedAfterTerminal, running, disposed, lastRun: clone(lastRun), lastGuard: clone(lastGuard) })
  });
}
