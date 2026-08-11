export const TURN_ACTION_LIMIT = 8;
export const TURN_TOKEN_LIMIT = 20_000;
export const SESSION_TOKEN_LIMIT = 200_000;
export const REPEATED_ACTION_LIMIT = 2;

function number(value) { return Number.isFinite(value) ? Number(value) : null; }

function firstNumber(value, keys) {
  for (const key of keys) {
    const result = number(value?.[key]);
    if (result !== null) return result;
  }
  return null;
}

export function normalizeUsage(value) {
  if (!value || typeof value !== "object") return null;
  const inputTokens = firstNumber(value, ["inputTokens", "input_tokens", "prompt_tokens", "promptTokenCount"]);
  const outputTokens = firstNumber(value, ["outputTokens", "output_tokens", "completion_tokens", "candidatesTokenCount"]);
  const totalTokens = firstNumber(value, ["totalTokens", "total_tokens"])
    ?? (inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null);
  const costUsd = firstNumber(value, ["costUsd"])
    ?? firstNumber(value.cost, ["total"]);
  const usage = {};
  if (inputTokens !== null) usage.inputTokens = inputTokens;
  if (outputTokens !== null) usage.outputTokens = outputTokens;
  if (totalTokens !== null) usage.totalTokens = totalTokens;
  if (costUsd !== null) usage.costUsd = costUsd;
  return Object.keys(usage).length ? usage : null;
}

export function usageFromResult(result) {
  const candidates = [
    result?.runState?.costLedger?.totals,
    result?.lastRun?.costLedger?.totals,
    result?.runState?.metrics?.usage,
    result?.metrics?.usage,
    result?.output?.usage,
    result?.output?.raw?.usage
  ];
  return candidates.map(normalizeUsage).find(Boolean) || null;
}

export function usageFromSessionState(state) {
  return normalizeUsage(state?.cumulativeUsage)
    || usageFromResult(state?.lastRun)
    || normalizeUsage(state?.lastTokenUsage);
}

export function subtractUsage(total, baseline) {
  if (!total) return null;
  const result = {};
  for (const key of ["inputTokens", "outputTokens", "totalTokens", "costUsd"]) {
    if (Number.isFinite(total[key])) result[key] = Math.max(0, total[key] - Number(baseline?.[key] || 0));
  }
  return Object.keys(result).length ? result : null;
}

function actionName(event) {
  const candidates = [
    event?.detail?.actionName,
    event?.detail?.info?.actionName,
    event?.detail?.detail?.actionName,
    event?.detail?.action?.name,
    event?.payload?.actionName
  ];
  return candidates.find((value) => typeof value === "string" && /^printform_[a-z0-9_]+$/u.test(value)) || null;
}

function eventUsage(event) {
  return normalizeUsage(event?.usage)
    || normalizeUsage(event?.detail?.usage)
    || normalizeUsage(event?.detail?.result?.usage);
}

function fingerprint(value) {
  let text;
  try { text = JSON.stringify(value ?? null); } catch { text = "[unserializable]"; }
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function actionFingerprint(event, action) {
  const args = event?.detail?.args ?? event?.detail?.actionArgs ?? event?.payload?.args;
  return `${action}:${fingerprint(args)}`;
}

function guardError(code, detail) {
  const messages = {
    TURN_ACTION_LIMIT: `This AI turn stopped after ${detail.actionLimit} PrintForm actions without a terminal result.`,
    TURN_TOKEN_LIMIT: `This AI turn stopped after ${detail.tokenLimit.toLocaleString()} tokens.`,
    REPEATED_ACTION: `This AI turn stopped because ${detail.action} repeated ${detail.repeatCount} times without progress.`
  };
  return Object.assign(new Error(messages[code] || "The AI turn was stopped by a safety guard."), { code, budget: detail });
}

export function createTurnGuard({ maxSteps = 100, actionLimit = TURN_ACTION_LIMIT, tokenLimit = TURN_TOKEN_LIMIT, repeatLimit = REPEATED_ACTION_LIMIT } = {}) {
  const configuredSteps = Number.isInteger(maxSteps) && maxSteps > 0 ? maxSteps : 100;
  const hardActionLimit = Math.min(configuredSteps, actionLimit);
  let actionCount = 0;
  let observedTokens = 0;
  let lastAction = null;
  let lastActionFingerprint = null;
  let repeatCount = 0;
  let stopped = null;

  function snapshot() {
    return { actionCount, actionLimit: hardActionLimit, observedTokens, tokenLimit, lastAction, repeatCount };
  }

  function observe(event) {
    if (stopped) return stopped;
    const usage = eventUsage(event);
    const reportsUsage = ["usage", "planner-responded", "provider-stream-finish", "provider-response"].includes(event?.type);
    if (reportsUsage && usage?.totalTokens !== null && usage?.totalTokens !== undefined) {
      observedTokens += usage.totalTokens;
      if (observedTokens >= tokenLimit) stopped = guardError("TURN_TOKEN_LIMIT", snapshot());
    }
    if (stopped) return stopped;
    const action = actionName(event);
    if (event?.type !== "tool_start") return null;
    actionCount += 1;
    const currentFingerprint = actionFingerprint(event, action);
    if (action && currentFingerprint === lastActionFingerprint) repeatCount += 1;
    else { lastAction = action; lastActionFingerprint = action ? currentFingerprint : null; repeatCount = action ? 1 : 0; }
    const detail = snapshot();
    if (actionCount > hardActionLimit) stopped = guardError("TURN_ACTION_LIMIT", detail);
    else if (observedTokens >= tokenLimit) stopped = guardError("TURN_TOKEN_LIMIT", detail);
    else if (action && repeatCount >= repeatLimit) stopped = guardError("REPEATED_ACTION", { ...detail, action });
    return stopped;
  }

  function observeFinalUsage(value) {
    if (stopped) return stopped;
    const usage = normalizeUsage(value);
    if (usage?.totalTokens !== null && usage?.totalTokens !== undefined) {
      observedTokens = Math.max(observedTokens, usage.totalTokens);
      if (observedTokens >= tokenLimit) stopped = guardError("TURN_TOKEN_LIMIT", snapshot());
    }
    return stopped;
  }

  return Object.freeze({ observe, observeFinalUsage, snapshot: () => Object.freeze(snapshot()), get error() { return stopped; } });
}
