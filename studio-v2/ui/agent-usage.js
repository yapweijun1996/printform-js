import { t } from "./ui-i18n.js";

function tokenCount(usage) {
  if (Number.isFinite(usage?.totalTokens)) return Number(usage.totalTokens);
  return Number(usage?.inputTokens || 0) + Number(usage?.outputTokens || 0);
}

export function usageLabel(usage) {
  if (!usage) return t("aiChat.usage.unavailable");
  const turnTokens = tokenCount(usage);
  const cost = Number.isFinite(usage.costUsd) ? ` · $${usage.costUsd.toFixed(6)}` : "";
  const sessionTokens = Number.isFinite(usage.sessionTotalTokens) ? Number(usage.sessionTotalTokens) : null;
  const session = sessionTokens === null ? "" : ` · ${t("aiChat.usage.session", { tokens: sessionTokens.toLocaleString() })}`;
  return `${t("aiChat.usage.turn", { tokens: turnTokens.toLocaleString(), cost })}${session}`;
}
