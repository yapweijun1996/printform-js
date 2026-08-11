import { createTurnGuard, SESSION_TOKEN_LIMIT, subtractUsage, usageFromResult, usageFromSessionState } from "./agent-budget.js";
import { projectRuntimeEvent } from "./agent-runtime-events.js";

function sessionState(session) {
  try { return typeof session?.getState === "function" ? session.getState() : null; }
  catch { return null; }
}

function usageEvent(controller, session, baselineUsage, result) {
  const runUsage = usageFromResult(result);
  const sessionUsage = usageFromSessionState(sessionState(session));
  const turnUsage = sessionUsage && baselineUsage ? subtractUsage(sessionUsage, baselineUsage) : runUsage;
  if (!turnUsage) return null;
  return {
    ...turnUsage,
    ...(sessionUsage?.totalTokens !== undefined ? { sessionTotalTokens: sessionUsage.totalTokens } : {}),
    ...(sessionUsage?.costUsd !== undefined ? { sessionCostUsd: sessionUsage.costUsd } : {})
  };
}

const DIAGNOSTIC_EVENT_TYPES = new Set(["action-error", "planner-native-parallel-batch"]);

function emitDiagnosticEvent(controller, event) {
  if (!DIAGNOSTIC_EVENT_TYPES.has(event?.type)) return;
  const publicEvent = projectRuntimeEvent(event);
  if (publicEvent) controller.emit(publicEvent);
}

function emitCompletedActionEvents(controller, detail) {
  const steps = detail?.result?.steps;
  if (!Array.isArray(steps)) return;
  for (const event of steps) {
    if (!["action-executed", "action-error", "planner-native-parallel-batch"].includes(event?.type)) continue;
    const publicEvent = projectRuntimeEvent(event);
    if (publicEvent) controller.emit(publicEvent);
  }
}

function publicOutcome(controller, result, completed) {
  const text = result && controller.outputText(result);
  const error = result?.error || completed?.error;
  const publicResult = result ? {
    ...(text ? { output: { text } } : {}),
    ...(error ? { error: { code: error.code || "RUNTIME_ERROR", message: "The provider turn failed." } } : {})
  } : null;
  return {
    result: publicResult,
    completed: completed && {
      terminalKind: completed.terminalKind,
      ...(error ? { error: { code: error.code || "RUNTIME_ERROR", message: "The provider turn failed." } } : {}),
      ...(publicResult ? { result: publicResult } : {})
    }
  };
}

export async function consumeRuntimeTurn(controller, input) {
  const session = await controller.session();
  const baselineUsage = usageFromSessionState(sessionState(session));
  if (baselineUsage?.totalTokens >= SESSION_TOKEN_LIMIT) {
    const error = Object.assign(new Error(`This chat has reached ${SESSION_TOKEN_LIMIT.toLocaleString()} tokens. Start a new chat before sending another request.`), { code: "SESSION_USAGE_LIMIT_REACHED", budget: baselineUsage });
    controller.emit({ type: "usage", usage: { totalTokens: 0, sessionTotalTokens: baselineUsage.totalTokens } });
    controller.emit({ type: "circuit_breaker_tripped", detail: { code: error.code, sessionTotalTokens: baselineUsage.totalTokens, sessionTokenLimit: SESSION_TOKEN_LIMIT } });
    controller.emit({ type: "runtime_error", detail: { code: error.code, message: error.message } });
    return { result: null, completed: { terminalKind: "error", error }, errorReported: true };
  }
  controller.abortController = new AbortController();
  const guard = createTurnGuard({ maxSteps: controller.maxSteps });
  controller.running = true;
  let completed = null;
  let guardError = null;
  let proposalReady = false;
  try {
    const stream = session.runStream(input, {
      abortSignal: controller.abortController.signal,
      onStreamEvent: (event) => emitDiagnosticEvent(controller, event),
      onToken: (token) => {
        controller.captureToken?.(token);
        controller.emit({ type: "token", text: typeof token === "string" ? token : token?.text || "" });
      },
      onBeforeFinalize: (runState, context) => controller.beforeFinalize?.(runState, context),
      onInvalidPlannerOutput: (text) => controller.recoverInvalidPlannerOutput?.(text)
    });
    for await (const event of stream) {
      if (controller.actionFailure) {
        controller.abortController.abort();
        break;
      }
      const stopped = guard.observe(event);
      if (stopped) {
        guardError = stopped;
        controller.emit({ type: "circuit_breaker_tripped", detail: { code: stopped.code, ...guard.snapshot() } });
        controller.abortController.abort();
        break;
      }
      if (event.type === "completed") {
        completed = event.detail;
        emitCompletedActionEvents(controller, event.detail);
      }
      const publicEvent = projectRuntimeEvent(event);
      if (publicEvent) controller.emit(publicEvent);
    }
  } catch (error) {
    if (!controller.actionFailure) completed = { terminalKind: controller.abortController.signal.aborted ? "abort" : "error", error };
  } finally {
    controller.running = false;
    controller.abortController = null;
  }
  let result = completed?.result || null;
  const resultText = result && controller.outputText(result);
  if (completed?.terminalKind === "done" && resultText && !controller.pendingProposal && !controller.actionFailure && !guardError) {
    try { await controller.recoverTextProposal(resultText); }
    catch (error) { controller.actionFailure = error; }
  }
  proposalReady = Boolean(controller.pendingProposal) && !controller.actionFailure && !guardError;
  if (controller.actionFailure) {
    completed = { terminalKind: "error", result: null, error: controller.actionFailure };
    result = null;
  } else if (guardError) {
    completed = { terminalKind: "error", result: completed?.result || null, error: guardError };
    result = completed.result || null;
  }
  else if (proposalReady) completed = { ...completed, terminalKind: "proposal_ready" };
  const usage = usageEvent(controller, session, baselineUsage, result);
  if (!guardError && usage && guard.observeFinalUsage(usage)) {
    guardError = guard.error;
    completed = { terminalKind: "error", result, error: guardError };
    controller.emit({ type: "circuit_breaker_tripped", detail: { code: guardError.code, ...guard.snapshot() } });
  }
  if (usage) controller.emit({ type: "usage", usage });
  controller.pendingApproval = guardError || proposalReady || controller.actionFailure ? null : controller.approvalFrom(result);
  if (controller.pendingApproval) {
    completed = { ...completed, terminalKind: "pending_approval" };
    controller.terminalState?.notePendingApproval();
    controller.emit({ type: "terminal_state", detail: { state: "pending_approval" } });
    controller.emit({ type: "approval_required", detail: { actionName: controller.pendingApproval.actionName } });
  }
  if (proposalReady) {
    controller.emit({ type: "terminal_state", detail: { state: "proposal_ready" } });
    controller.emit({ type: "proposal_ready", detail: { proposalId: controller.pendingProposal.proposalId } });
  }
  const runtimeError = controller.actionFailure || guardError || result?.error || completed?.error;
  if (runtimeError) controller.emit({ type: "runtime_error", detail: { code: runtimeError.code || "RUNTIME_ERROR", message: "The provider turn failed." } });
  if (!proposalReady && result && controller.outputText(result)) controller.emit({ type: "assistant_text", text: controller.outputText(result) });
  if (completed?.terminalKind === "abort" && !proposalReady) controller.emit({ type: "stopped" });
  return { ...publicOutcome(controller, result, completed), errorReported: Boolean(runtimeError) };
}
