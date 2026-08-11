export const TERMINAL_FINALIZE_ATTEMPTS = 3;

function positiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function createTerminalState({ maxFinalizeAttempts = TERMINAL_FINALIZE_ATTEMPTS } = {}) {
  const limit = positiveInteger(maxFinalizeAttempts, TERMINAL_FINALIZE_ATTEMPTS);
  let state = "running";
  let terminalAction = null;
  let proposalReady = false;
  let pendingApproval = false;
  let finalizeAttempts = 0;

  function reset() {
    state = "running";
    terminalAction = null;
    proposalReady = false;
    pendingApproval = false;
    finalizeAttempts = 0;
  }

  function noteAction({ name, control, phase, ok }) {
    if (phase !== "completed" || ok !== true || control !== "complete") return false;
    terminalAction = typeof name === "string" ? name : null;
    state = "terminal_action";
    return true;
  }

  function noteProposalReady() {
    proposalReady = true;
    pendingApproval = false;
    state = "proposal_ready";
  }

  function clearProposal() {
    proposalReady = false;
    if (state === "proposal_ready") state = "running";
  }

  function notePendingApproval() {
    pendingApproval = true;
    state = "pending_approval";
  }

  function noteApplied() {
    proposalReady = false;
    pendingApproval = false;
    state = "applied";
  }

  function noteStopped() {
    proposalReady = false;
    pendingApproval = false;
    state = "stopped";
  }

  function noteBlocked() { state = "blocked"; }

  function isTerminalReady() {
    return Boolean(terminalAction || proposalReady || pendingApproval);
  }

  function requestRepair() {
    if (isTerminalReady()) return { ready: true, attempt: finalizeAttempts, maxAttempts: limit };
    finalizeAttempts += 1;
    return {
      ready: false,
      attempt: finalizeAttempts,
      maxAttempts: limit,
      exhausted: finalizeAttempts >= limit
    };
  }

  function snapshot() {
    return Object.freeze({
      state, terminalAction, proposalReady, pendingApproval,
      finalizeAttempts, maxFinalizeAttempts: limit
    });
  }

  return Object.freeze({
    reset, noteAction, noteProposalReady, clearProposal, notePendingApproval,
    noteApplied, noteStopped, noteBlocked, isTerminalReady, requestRepair, snapshot
  });
}
