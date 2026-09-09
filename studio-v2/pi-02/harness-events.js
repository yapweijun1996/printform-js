const EVENT_TYPES = Object.freeze([
  "run_start", "run_end", "turn_start", "turn_end", "tool_start", "tool_end",
  "usage", "fault", "handler_error"
]);

function safeActionName(value) {
  return typeof value === "string" && /^printform_[a-z0-9_]+$/u.test(value) ? value : "unknown";
}
function safeCode(value, fallback = "HARNESS_EVENT") {
  return typeof value === "string" && /^[A-Z0-9_:-]+$/u.test(value) ? value : fallback;
}

function numeric(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

export function normalizeHarnessUsage(value) {
  if (!value || typeof value !== "object") return null;
  const inputTokens = numeric(value.inputTokens ?? value.input ?? value.prompt_tokens);
  const outputTokens = numeric(value.outputTokens ?? value.output ?? value.completion_tokens);
  const totalTokens = numeric(value.totalTokens ?? value.total_tokens ?? value.total)
    ?? (inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null);
  const costUsd = numeric(value.costUsd ?? value.cost?.total);
  const usage = {};
  if (inputTokens !== null) usage.inputTokens = inputTokens;
  if (outputTokens !== null) usage.outputTokens = outputTokens;
  if (totalTokens !== null) usage.totalTokens = totalTokens;
  if (costUsd !== null) usage.costUsd = costUsd;
  return Object.keys(usage).length ? usage : null;
}

function toolDetails(event) {
  const result = event?.result;
  const details = result?.details;
  return details && typeof details === "object" && !Array.isArray(details) ? details : {};
}

export function projectHarnessEvent(event) {
  if (!event || typeof event.type !== "string") return null;
  if (event.type === "run_start") {
    return { type: "turn_start", detail: { source: "pi-harness", phase: "execution" } };
  }
  if (event.type === "turn_start") {
    return { type: "turn_start", detail: { source: "pi-harness", phase: "planning" } };
  }
  if (event.type === "tool_start") {
    return { type: "tool_start", detail: { actionName: safeActionName(event.toolName), phase: "started" } };
  }
  if (event.type === "tool_end") {
    const details = toolDetails(event);
    const projected = {
      type: "tool_result",
      detail: {
        actionName: safeActionName(event.toolName),
        phase: "completed",
        status: event.isError ? "error" : "success",
        control: details.control === "complete" ? "complete" : "continue",
        kind: "printform_result",
        resultEnvelopeVersion: "v1"
      }
    };
    if (details.terminal === true) projected.detail.terminal = true;
    if (details.errorCode) projected.detail.errorCode = safeCode(details.errorCode, "PRINTFORM_ACTION_FAILED");
    return projected;
  }
  if (event.type === "usage") {
    const usage = normalizeHarnessUsage(event.row?.usage ?? event.usage ?? event.totals);
    return usage ? { type: "usage", detail: usage } : null;
  }
  if (event.type === "run_end") {
    return {
      type: "completed",
      detail: {
        source: "pi-harness",
        status: event.status === "completed" ? "completed" : event.status === "aborted" ? "aborted" : "failed",
        terminalKind: event.status === "completed" ? "done" : event.status === "aborted" ? "abort" : "error"
      }
    };
  }
  if (event.type === "fault" || event.type === "handler_error") {
    return { type: "runtime_error", detail: { code: safeCode(event.code, "HARNESS_HANDLER_ERROR") } };
  }
  return null;
}

export function attachHarnessEventProjection(harness, onEvent, rawTypes = new Set()) {
  const unsubs = EVENT_TYPES.map((type) => harness.events.on(type, (event) => {
    rawTypes.add(type);
    const projected = projectHarnessEvent(event);
    if (projected) onEvent(projected, event);
  }));
  return () => unsubs.forEach((unsubscribe) => unsubscribe());
}
