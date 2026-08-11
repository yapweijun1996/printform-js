import { SAFE_TRACE_TYPES } from "./agent-trace-events.js";

const SAFE_PHASES = new Set(["preflight", "planning", "provider", "streaming", "tool", "execution", "approval", "finalize", "observe", "orient", "decide", "act", "evaluate"]);
const SAFE_STATUSES = new Set(["ok", "error", "stopped", "pending", "approved", "denied", "ready", "blocked", "success", "failure", "protocol_error"]);
const SAFE_CONTROLS = new Set(["continue", "stop", "complete"]);
const SAFE_KINDS = new Set(["printform_result", "action_envelope_protocol_error", "action_execute_error"]);
const SAFE_TRANSITIONS = new Set(["started", "completed"]);
const SAFE_OUTCOMES = new Set(["selected", "executed", "complete", "error", "skipped", "continue", "stop", "blocked", "pending"]);
const SAFE_TERMINALS = new Set(["done", "abort", "error", "proposal_ready", "pending_approval"]);
const SAFE_TERMINAL_STATES = new Set(["running", "terminal_action", "proposal_ready", "pending_approval", "applied", "stopped", "blocked"]);
const SAFE_PROVIDERS = new Set(["openai", "gemini", "custom"]);

function atPath(value, path) { return path.reduce((current, key) => current && typeof current === "object" ? current[key] : undefined, value); }
function first(value, paths) {
  for (const path of paths) {
    const candidate = atPath(value, path);
    if (candidate !== undefined && candidate !== null) return candidate;
  }
  return null;
}
function safeLabel(value, maximum = 96) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maximum && /^[\w.:-]+$/u.test(trimmed) ? trimmed : null;
}
function safeNumber(value) { return Number.isInteger(value) && value >= 0 && value <= 1000 ? Number(value) : null; }
function safeMetric(value) { return Number.isFinite(value) && value >= 0 && value <= 1_000_000_000 ? Number(value) : null; }
function safeEnum(value, allowed) { return typeof value === "string" && allowed.has(value) ? value : null; }
function safeCode(value) { return typeof value === "string" && /^[A-Z][A-Z0-9_]{1,63}$/.test(value) ? value : null; }
function safeAction(value) { return typeof value === "string" && /^printform_[a-z0-9_]{1,72}$/.test(value) ? value : null; }
function safeHash(value, length) { return typeof value === "string" && new RegExp(`^[a-f0-9]{${length}}$`).test(value) ? value : null; }
function safeBuildId(value) { return typeof value === "string" && /^[a-zA-Z0-9._-]{1,96}$/.test(value) ? value : null; }
function safeEnvelopeVersion(value) { return typeof value === "string" && /^v[0-9]{1,3}$/.test(value) ? value : null; }

function errorCode(event) {
  return safeCode(first(event, [["code"], ["detail", "code"], ["detail", "error", "code"], ["detail", "result", "error", "code"], ["detail", "info", "error", "code"], ["payload", "code"], ["payload", "error", "code"]]));
}
function actionName(event) {
  return safeAction(first(event, [["actionName"], ["detail", "actionName"], ["detail", "info", "actionName"], ["detail", "action", "name"], ["detail", "info", "action", "name"], ["detail", "detail", "actionName"], ["detail", "tool", "name"], ["payload", "actionName"]]));
}
function eventStatus(event) {
  if (event.type === "tool_result") {
    const ok = first(event, [["detail", "ok"], ["detail", "result", "ok"], ["detail", "info", "ok"]]);
    if (typeof ok === "boolean") return ok ? "ok" : "error";
  }
  if (event.type === "runtime_error") return "error";
  if (event.type === "stopped") return "stopped";
  return safeEnum(first(event, [["status"], ["detail", "status"], ["detail", "info", "status"], ["payload", "status"]]), SAFE_STATUSES);
}

export function sanitizeTraceEvent(event, context = {}) {
  const type = safeLabel(event?.type, 48);
  if (!type || !SAFE_TRACE_TYPES.has(type) || type === "assistant_text") return null;
  const detail = event.detail && typeof event.detail === "object" ? event.detail : {};
  const record = { sequence: context.sequence, elapsedMs: context.elapsedMs, turn: context.turn, type };
  const phase = safeEnum(first(event, [["phase"], ["detail", "phase"], ["detail", "info", "phase"]]), SAFE_PHASES);
  const cycle = safeNumber(first(event, [["cycle"], ["detail", "cycle"], ["detail", "info", "cycle"], ["payload", "cycle"]]));
  const action = actionName(event);
  const status = eventStatus(event);
  const code = errorCode(event);
  const control = safeEnum(first(event, [["control"], ["detail", "control"], ["detail", "info", "control"], ["detail", "result", "control"]]), SAFE_CONTROLS);
  const resultKind = safeEnum(first(event, [["kind"], ["detail", "kind"], ["detail", "info", "kind"], ["detail", "result", "kind"], ["detail", "result", "output", "kind"], ["detail", "resultKind"]]), SAFE_KINDS);
  const resultEnvelopeVersion = safeEnvelopeVersion(first(event, [["resultEnvelopeVersion"], ["detail", "resultEnvelopeVersion"], ["detail", "info", "resultEnvelopeVersion"], ["detail", "result", "resultEnvelopeVersion"]]));
  const planIndex = safeNumber(first(event, [["planIndex"], ["detail", "planIndex"], ["detail", "info", "planIndex"], ["detail", "action", "planIndex"], ["detail", "plan", "index"]]));
  const runtimeBuildId = safeBuildId(first(event, [["runtimeBuildId"], ["detail", "runtimeBuildId"], ["detail", "info", "runtimeBuildId"], ["detail", "result", "runState", "runtimeBuildId"]]));
  const agrunCommit = safeHash(first(event, [["detail", "agrunCommit"], ["detail", "info", "agrunCommit"]]), 40);
  const agrunSha256 = safeHash(first(event, [["detail", "agrunSha256"], ["detail", "info", "agrunSha256"]]), 64);
  const terminalKind = safeEnum(first(event, [["detail", "terminalKind"], ["detail", "info", "terminalKind"]]), SAFE_TERMINALS);
  const transition = safeEnum(first(event, [["detail", "transition"], ["detail", "info", "transition"]]), SAFE_TRANSITIONS);
  const outcome = safeEnum(first(event, [["detail", "outcome"], ["detail", "info", "outcome"], ["detail", "info", "evaluationState", "outcome"]]), SAFE_OUTCOMES);
  const terminalState = safeEnum(first(event, [["detail", "state"], ["detail", "terminalState"]]), SAFE_TERMINAL_STATES);
  const attempt = safeNumber(first(event, [["detail", "attempt"]]));
  const maxAttempts = safeNumber(first(event, [["detail", "maxAttempts"]]));
  const provider = type === "runtime_config" ? safeEnum(detail.provider, SAFE_PROVIDERS) : null;
  const model = type === "runtime_config" ? safeLabel(detail.model, 80) : null;
  const maxSteps = type === "runtime_config" ? safeNumber(detail.maxSteps) : null;
  const hasBudget = type === "runtime_config" || type === "circuit_breaker_tripped";
  const actionLimit = hasBudget ? safeNumber(detail.actionLimit) : null;
  const tokenLimit = hasBudget ? safeMetric(detail.tokenLimit || detail.sessionTokenLimit) : null;
  const usageSource = type === "usage" ? event.usage : detail;
  const totalTokens = type === "usage" ? safeMetric(usageSource?.totalTokens) : null;
  const sessionTotalTokens = type === "usage" || type === "circuit_breaker_tripped" ? safeMetric(usageSource?.sessionTotalTokens) : null;
  const actionCount = type === "circuit_breaker_tripped" ? safeNumber(detail.actionCount) : null;
  const pass = safeNumber(detail.pass);
  Object.assign(record, { ...(phase ? { phase } : {}), ...(cycle !== null ? { cycle } : {}), ...(context.step ? { step: context.step } : {}), ...(action ? { action } : {}), ...(status ? { status } : {}), ...(code ? { code } : {}), ...(control ? { control } : {}), ...(resultKind ? { resultKind } : {}), ...(resultEnvelopeVersion ? { resultEnvelopeVersion } : {}), ...(planIndex !== null ? { planIndex } : {}), ...(runtimeBuildId ? { runtimeBuildId } : {}), ...(agrunCommit ? { agrunCommit } : {}), ...(agrunSha256 ? { agrunSha256 } : {}), ...(terminalKind ? { terminalKind } : {}), ...(transition ? { transition } : {}), ...(outcome ? { outcome } : {}), ...(terminalState ? { terminalState } : {}), ...(attempt !== null ? { attempt } : {}), ...(maxAttempts !== null ? { maxAttempts } : {}), ...(provider ? { provider } : {}), ...(model ? { model } : {}), ...(maxSteps !== null ? { maxSteps } : {}), ...(actionLimit !== null ? { actionLimit } : {}), ...(tokenLimit !== null ? { tokenLimit } : {}), ...(totalTokens !== null ? { totalTokens } : {}), ...(sessionTotalTokens !== null ? { sessionTotalTokens } : {}), ...(actionCount !== null ? { actionCount } : {}), ...(pass !== null ? { pass } : {}) });
  return Object.freeze(record);
}
