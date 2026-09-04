// Maps an aiChat.status.* i18n key to a visual tone for #ai-status-dot in the
// panel header. Pure; the full status text still lives in the hidden #ai-status
// live region and the dot's title attribute.

const BUSY = new Set([
  "thinking", "running", "applying", "autoApplying", "reviewing", "rejecting",
  "actionRunning", "actionSelected", "approval"
]);
const ERROR = new Set([
  "failed", "applyFailed", "safetyStopped", "reviewBlocked", "gatewayTokenRequired"
]);
const IDLE = new Set([
  "stopped", "rejected", "approvalNotRequested"
]);

export function toneForStatusKey(statusKey) {
  if (typeof statusKey !== "string") return "ready";
  const suffix = statusKey.startsWith("aiChat.status.")
    ? statusKey.slice("aiChat.status.".length)
    : statusKey;
  if (ERROR.has(suffix)) return "error";
  if (BUSY.has(suffix)) return "busy";
  if (IDLE.has(suffix)) return "idle";
  return "ready";
}
