import { t } from "./ui-i18n.js";
import { AUDIT_TRACE_TYPES, TRACE_LIFECYCLE_LABELS } from "./agent-trace-events.js";
import { sanitizeTraceEvent } from "./agent-trace-sanitize.js";

const TRACE_VERSION = "1.0.0";
const ACTION_PHASES = new Set(["decide", "act"]);

export { sanitizeTraceEvent };

export function createAgentTrace({ limit = 200, now = () => Date.now() } = {}) {
  const maximum = Number.isInteger(limit) && limit > 0 ? limit : 200;
  const startedAt = now();
  const listeners = new Set();
  let records = [];
  let sequence = 0;
  let turn = 0;
  let step = 0;
  function notify() { listeners.forEach((listener) => listener()); }
  function observe(event) {
    if (event?.type === "turn_start") { turn += 1; step = 0; }
    if (event?.type === "tool_start") step += 1;
    const record = sanitizeTraceEvent(event, { sequence: sequence + 1, elapsedMs: Math.max(0, now() - startedAt), turn, step });
    if (!record) return null;
    sequence += 1;
    records = [...records, record].slice(-maximum);
    notify();
    return record;
  }
  function clear() { records = []; step = 0; notify(); }
  function getSnapshot() { return Object.freeze(records.map((record) => Object.freeze({ ...record }))); }
  function getAuditSnapshot() { return Object.freeze(buildAuditRows(getSnapshot()).map((record) => Object.freeze({ ...record }))); }
  function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  return Object.freeze({ observe, clear, getSnapshot, getAuditSnapshot, subscribe });
}

export function traceActionLabel(action) {
  if (!action) return t("aiChat.status.printformAction");
  const words = action.replace(/^printform_/, "").split("_");
  const readable = words.map((word) => word ? `${word[0].toUpperCase()}${word.slice(1)}` : word).join(" ");
  return `${readable} [${action}]`;
}

function auditPrefix(record) {
  const sequence = record.lastSequence && record.lastSequence !== record.sequence ? `#${record.sequence}→#${record.lastSequence}` : `#${record.sequence}`;
  const parts = [sequence, `+${(record.elapsedMs / 1000).toFixed(1)}s`, `turn ${record.turn || 0}`];
  if (record.step) parts.push(`step ${record.step}`);
  return parts;
}

function actionRow(record, stage) {
  return {
    kind: "action", sequence: record.sequence, lastSequence: record.sequence,
    elapsedMs: record.elapsedMs, turn: record.turn, step: record.step, action: record.action,
    selected: stage === "selected", started: stage === "started", hasResult: stage === "result",
    executed: stage === "executed", outcome: record.outcome, status: record.status,
    control: record.control, resultKind: record.resultKind,
    resultEnvelopeVersion: record.resultEnvelopeVersion, planIndex: record.planIndex
  };
}

function pendingAction(rows, record) {
  return [...rows].reverse().find((row) => row.kind === "action" && row.turn === record.turn && row.action === record.action && !row.executed);
}

function mergeAction(rows, record, stage) {
  if (stage === "selected") {
    rows.push(actionRow(record, stage));
    return;
  }
  const row = pendingAction(rows, record);
  if (!row) {
    rows.push(actionRow(record, stage));
    return;
  }
  row.lastSequence = record.sequence;
  if (record.elapsedMs !== undefined) row.lastElapsedMs = record.elapsedMs;
  if (record.step) row.step = record.step;
  if (stage === "started") row.started = true;
  if (stage === "result") row.hasResult = true;
  if (stage === "executed") row.executed = true;
  if (record.outcome) row.outcome = record.outcome;
  if (record.status) row.status = record.status;
  if (record.control) row.control = record.control;
  if (record.resultKind) row.resultKind = record.resultKind;
  if (record.resultEnvelopeVersion) row.resultEnvelopeVersion = record.resultEnvelopeVersion;
  if (record.planIndex !== null && record.planIndex !== undefined) row.planIndex = record.planIndex;
}

export function visibleRecord(record) {
  if (record.type === "phase") return Boolean(record.action && ACTION_PHASES.has(record.phase));
  if (record.type === "tool_start" || record.type === "tool_result") return Boolean(record.action);
  return AUDIT_TRACE_TYPES.has(record.type);
}

export function buildAuditRows(snapshot) {
  const rows = [];
  for (const record of snapshot) {
    if (record.type === "phase" && record.action && ACTION_PHASES.has(record.phase)) {
      mergeAction(rows, record, record.phase === "decide" ? "selected" : "executed");
    } else if (record.type === "tool_start" && record.action) {
      mergeAction(rows, record, "started");
    } else if (record.type === "tool_result" && record.action) {
      mergeAction(rows, record, "result");
    } else if (visibleRecord(record)) {
      rows.push({ kind: "event", ...record });
    }
  }
  const occurrences = new Map();
  return rows.map((row) => {
    if (row.kind !== "action") return row;
    const occurrence = (occurrences.get(row.action) || 0) + 1;
    occurrences.set(row.action, occurrence);
    return { ...row, occurrence };
  });
}

function lifecycleText(record) {
  const parts = [`${TRACE_LIFECYCLE_LABELS[record.type] || record.type} [${record.type}]`];
  if (record.provider || record.model) parts.push([record.provider, record.model].filter(Boolean).join(" / "));
  if (record.maxSteps) parts.push(`maxSteps=${record.maxSteps}`);
  if (record.totalTokens !== undefined) parts.push(`turnTokens=${record.totalTokens.toLocaleString()}`);
  if (record.sessionTotalTokens !== undefined) parts.push(`sessionTokens=${record.sessionTotalTokens.toLocaleString()}`);
  if (record.actionCount !== undefined) parts.push(`actions=${record.actionCount}/${record.actionLimit || "?"}`);
  if (record.pass !== undefined) parts.push(`pass=${record.pass}`);
  if (record.terminalState) parts.push(record.terminalState);
  if (record.attempt !== undefined) parts.push(`attempt=${record.attempt}/${record.maxAttempts || "?"}`);
  if (record.terminalKind) parts.push(record.terminalKind);
  if (record.control || record.resultKind) parts.push([record.control, record.resultKind].filter(Boolean).join("/"));
  if (record.resultEnvelopeVersion) parts.push(record.resultEnvelopeVersion);
  if (record.planIndex !== undefined) parts.push(`planIndex=${record.planIndex}`);
  if (record.runtimeBuildId) parts.push(`build=${record.runtimeBuildId}`);
  if (record.agrunCommit) parts.push(`agrun=${record.agrunCommit.slice(0, 12)}`);
  if (record.status && record.status !== "ok") parts.push(record.status);
  if (record.outcome) parts.push(record.outcome);
  if (record.code) parts.push(record.code);
  return parts.join(" · ");
}

export function formatTraceRecord(record) {
  const prefix = auditPrefix(record);
  if (record.kind === "action") {
    const states = [];
    if (record.selected) states.push(t("aiChat.trace.selected", {}, "selected"));
    if (record.started && !record.executed) states.push(t("aiChat.trace.started", {}, "started"));
    if (record.executed) states.push(t("aiChat.trace.executed", {}, "executed"));
    else if (record.hasResult) states.push(`${t("aiChat.trace.result", {}, "result")}=${record.status || "ok"}`);
    const details = [`step ${record.step || "?"}`, traceActionLabel(record.action), states.join(" → ") || t("aiChat.trace.pending", {}, "pending")];
    if (record.outcome) details.push(`outcome=${record.outcome}`);
    if (record.control || record.resultKind) details.push(`result=${[record.control, record.resultKind].filter(Boolean).join("/")}`);
    if (record.resultEnvelopeVersion) details.push(record.resultEnvelopeVersion);
    if (record.planIndex !== undefined) details.push(`planIndex=${record.planIndex}`);
    if (record.status && record.status !== "ok") details.push(record.status);
    if (record.occurrence > 1) details.push(t("aiChat.trace.repeat", { count: record.occurrence }, `repeat #${record.occurrence}`));
    return [...prefix, ...details].join(" · ");
  }
  return [...prefix, lifecycleText(record)].join(" · ");
}

export function bindAgentTrace({ get = (selector) => document.querySelector(selector), target = window } = {}) {
  const trace = createAgentTrace();
  const log = get("#ai-trace-log");
  const count = get("#ai-trace-count");
  function render() {
    const audit = trace.getAuditSnapshot();
    count.textContent = String(audit.length);
    log.replaceChildren();
    if (!audit.length) {
      const empty = document.createElement("li");
      empty.className = "ai-trace-empty";
      empty.textContent = t("aiChat.trace.empty");
      log.append(empty);
      return;
    }
    for (const record of audit.slice(-80)) {
      const item = document.createElement("li");
      item.className = `ai-trace-item ai-trace-${record.kind}`;
      if (record.status === "error" || record.kind === "event" && record.type === "circuit_breaker_tripped") item.classList.add("ai-trace-error");
      item.textContent = formatTraceRecord(record);
      log.append(item);
    }
    log.scrollTop = log.scrollHeight;
  }
  trace.subscribe(render);
  get("#ai-trace-clear").addEventListener("click", trace.clear);
  get("#ai-trace-copy").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    try {
      await navigator.clipboard.writeText(JSON.stringify(trace.getSnapshot(), null, 2));
      button.textContent = t("aiChat.trace.copied");
      setTimeout(() => { button.textContent = t("aiChat.trace.copy"); }, 1200);
    } catch { button.textContent = t("aiChat.trace.copyFailed"); }
  });
  const api = Object.freeze({ version: TRACE_VERSION, getSnapshot: trace.getSnapshot, getAuditSnapshot: trace.getAuditSnapshot, clear: trace.clear });
  Object.defineProperty(target, "PrintFormStudioAgentTrace", { value: api, configurable: true, enumerable: false });
  render();
  return Object.freeze({ observe: trace.observe, render, getSnapshot: trace.getSnapshot, getAuditSnapshot: trace.getAuditSnapshot });
}
