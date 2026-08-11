const SAFE_PHASES = new Set([
  "preflight", "planning", "provider", "streaming", "tool", "execution",
  "approval", "finalize", "observe", "orient", "decide", "act", "evaluate"
]);
const SAFE_STATUS = new Set([
  "ok", "error", "stopped", "pending", "approved", "denied", "ready",
  "blocked", "success", "failure", "protocol_error"
]);
const SAFE_CONTROLS = new Set(["continue", "stop", "complete"]);
const SAFE_KINDS = new Set(["printform_result", "action_envelope_protocol_error", "action_execute_error"]);
const SAFE_OUTCOMES = new Set([
  "selected", "executed", "complete", "error", "skipped", "continue",
  "stop", "blocked", "pending"
]);

function safeAction(value) {
  return typeof value === "string" && /^printform_[a-z0-9_]{1,72}$/u.test(value)
    ? value : undefined;
}

function safeCode(value) {
  return typeof value === "string" && /^[A-Z][A-Z0-9_]{1,63}$/u.test(value)
    ? value : undefined;
}

function safeKind(value) {
  return typeof value === "string" && SAFE_KINDS.has(value) ? value : undefined;
}

function safeEnvelopeVersion(value) {
  return typeof value === "string" && /^v[0-9]{1,3}$/u.test(value) ? value : undefined;
}

function safeBuildId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9._-]{1,96}$/u.test(value) ? value : undefined;
}

function safeHash(value, length) {
  return typeof value === "string" && new RegExp(`^[a-f0-9]{${length}}$`, "u").test(value) ? value : undefined;
}

function safeIndex(value) {
  return Number.isInteger(value) && value >= 0 && value <= 1000 ? value : undefined;
}

function safeEnum(value, allowed) {
  return typeof value === "string" && allowed.has(value) ? value : undefined;
}

function safeNumber(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1_000_000_000
    ? Number(value) : undefined;
}

function first(values) { return values.find((value) => value !== undefined && value !== null); }

function actionName(event) {
  return safeAction(first([
    event?.actionName,
    event?.detail?.actionName,
    event?.detail?.info?.actionName,
    event?.detail?.action?.name,
    event?.detail?.detail?.actionName,
    event?.payload?.actionName
  ]));
}

function detailProjection(event) {
  const detail = event?.detail && typeof event.detail === "object" ? event.detail : {};
  const projected = {};
  const action = actionName(event);
  const phase = safeEnum(first([event.phase, detail.phase, detail.info?.phase]), SAFE_PHASES);
  const status = safeEnum(first([event.status, detail.status, detail.info?.status]), SAFE_STATUS);
  const outcome = safeEnum(first([
    detail.outcome, detail.info?.outcome, detail.info?.evaluationState?.outcome
  ]), SAFE_OUTCOMES);
  const code = safeCode(first([
    event.code, detail.code, detail.error?.code, detail.result?.error?.code, detail.info?.error?.code
  ]));
  const control = safeEnum(first([
    event.control, detail.control, detail.info?.control, detail.result?.control
  ]), SAFE_CONTROLS);
  const kind = safeKind(first([
    event.kind, detail.kind, detail.info?.kind, detail.result?.kind,
    detail.result?.output?.kind, detail.resultKind
  ]));
  const resultEnvelopeVersion = safeEnvelopeVersion(first([
    event.resultEnvelopeVersion, detail.resultEnvelopeVersion,
    detail.info?.resultEnvelopeVersion, detail.result?.resultEnvelopeVersion
  ]));
  const planIndex = safeIndex(first([
    event.planIndex, detail.planIndex, detail.info?.planIndex,
    detail.action?.planIndex, detail.plan?.index
  ]));
  const runtimeBuildId = safeBuildId(first([
    event.runtimeBuildId, detail.runtimeBuildId, detail.info?.runtimeBuildId,
    detail.result?.runState?.runtimeBuildId
  ]));
  const agrunCommit = safeHash(first([detail.agrunCommit, detail.info?.agrunCommit]), 40);
  const agrunSha256 = safeHash(first([detail.agrunSha256, detail.info?.agrunSha256]), 64);
  if (action) projected.actionName = action;
  if (phase) projected.phase = phase;
  if (status) projected.status = status;
  if (outcome) projected.outcome = outcome;
  if (code) projected.code = code;
  if (control) projected.control = control;
  if (kind) projected.kind = kind;
  if (resultEnvelopeVersion) projected.resultEnvelopeVersion = resultEnvelopeVersion;
  if (planIndex !== undefined) projected.planIndex = planIndex;
  if (runtimeBuildId) projected.runtimeBuildId = runtimeBuildId;
  if (agrunCommit) projected.agrunCommit = agrunCommit;
  if (agrunSha256) projected.agrunSha256 = agrunSha256;
  if (typeof detail.ok === "boolean") projected.ok = detail.ok;
  if (["started", "completed"].includes(detail.transition)) projected.transition = detail.transition;
  if (["done", "abort", "error", "proposal_ready", "pending_approval"].includes(detail.terminalKind)) projected.terminalKind = detail.terminalKind;
  return projected;
}

function usageProjection(event) {
  const source = event?.usage || event?.detail?.usage || {};
  const usage = {};
  for (const key of ["inputTokens", "outputTokens", "totalTokens", "costUsd", "sessionTotalTokens", "sessionCostUsd"]) {
    const value = safeNumber(source[key]);
    if (value !== undefined) usage[key] = value;
  }
  return usage;
}

export function projectRuntimeEvent(event) {
  if (!event || typeof event.type !== "string") return null;
  if (event.type === "token") {
    return { type: "token", text: typeof event.text === "string" ? event.text : "" };
  }
  if (event.type === "usage") return { type: "usage", usage: usageProjection(event) };
  const detail = detailProjection(event);
  const projected = { type: event.type };
  const phase = safeEnum(event.phase, SAFE_PHASES);
  const cycle = Number.isInteger(event.cycle) && event.cycle >= 0 && event.cycle <= 1000
    ? event.cycle : undefined;
  if (phase) projected.phase = phase;
  if (cycle !== undefined) projected.cycle = cycle;
  if (Object.keys(detail).length) projected.detail = detail;
  return projected;
}
