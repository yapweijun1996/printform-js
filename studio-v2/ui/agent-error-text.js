import { t } from "./ui-i18n.js";

const EXACT_KEYS = new Map([
  ["The provider turn failed.", "aiChat.errors.providerTurn"],
  ["Unlock and save a provider profile first.", "aiChat.errors.profileRequired"],
  ["Cannot open the AI session.", "aiChat.errors.openSession"],
  ["Cannot start the AI session.", "aiChat.errors.startSession"],
  ["Cannot start provider turn.", "aiChat.errors.providerTurnStart"],
  ["Approval resolution failed.", "aiChat.errors.approvalResolution"],
  ["Resolve the pending approval before starting another design turn.", "aiChat.errors.pendingApproval"],
  ["Resolve the pending approval before starting a layout review.", "aiChat.errors.pendingApproval"],
  ["There is no pending approval", "aiChat.errors.noPendingApproval"],
  ["Approval is required before applying this proposal.", "aiChat.errors.approvalRequired"],
  ["The proposal must be previewed again.", "aiChat.errors.previewAgain"],
  ["Choose OpenAI, Gemini or Custom LLM.", "aiChat.errors.chooseProvider"],
  ["A model name is required.", "aiChat.errors.modelRequired"],
  ["A current-session Gateway token is required.", "aiChat.errors.gatewayTokenRequired"],
  ["An API key is required.", "aiChat.errors.apiKeyRequired"],
  ["Custom LLM requires an HTTPS or localhost endpoint.", "aiChat.errors.customEndpointRequired"],
  ["Provider endpoint must use HTTPS, or HTTP on localhost only.", "aiChat.errors.unsafeEndpoint"],
  ["API variant must be chat or responses.", "aiChat.errors.apiVariant"],
  ["Provide both input and output token prices, or leave both blank.", "aiChat.errors.tokenPricesPair"],
  ["Maximum cost must be greater than zero when provided.", "aiChat.errors.maxCost"],
  ["Session index request failed", "aiChat.errors.sessionIndexRequest"],
  ["Cannot open session index", "aiChat.errors.sessionIndexOpen"],
  ["Session database is still in use", "aiChat.errors.sessionInUse"],
  ["Cannot delete session database", "aiChat.errors.sessionDelete"],
  ["Cannot create session", "aiChat.errors.sessionCreate"],
  ["agrun runtime is unavailable", "aiChat.errors.runtimeUnavailable"],
  ["Unlock the provider vault first", "aiChat.errors.unlockVault"],
  ["Cannot unlock provider vault with this passphrase", "aiChat.errors.vaultUnlock"],
  ["Provider profile id is invalid", "aiChat.errors.profileId"],
  ["Provider, model and API key are required", "aiChat.errors.profileIncomplete"],
  ["Cannot clear provider vault while it is in use", "aiChat.errors.vaultInUse"],
  ["Cannot clear provider vault", "aiChat.errors.vaultClear"],
  ["IndexedDB request failed", "aiChat.errors.indexedDb"],
  ["Cannot open vault database", "aiChat.errors.vaultOpen"]
]);
const CODE_KEYS = new Map([
  ["TERMINAL_ACTION_REQUIRED", "aiChat.errors.terminalActionRequired"],
  ["AUTO_REPAIR_LIMIT_REACHED", "aiChat.errors.repairLimit"],
  ["REPEATED_LAYOUT_REPAIR", "aiChat.errors.repeatedRepair"],
  ["LAYOUT_REVIEW_DECISION_REQUIRED", "aiChat.errors.reviewDecision"],
  ["LAYOUT_OBSERVATION_UNAVAILABLE", "aiChat.errors.reviewObservation"],
  ["LAYOUT_REPAIR_ACTION_REQUIRED", "aiChat.errors.reviewAction"]
]);

function messageOf(error) {
  return typeof error === "string" ? error : error?.message;
}

function keyFor(message) {
  if (!message) return null;
  if (EXACT_KEYS.has(message)) return EXACT_KEYS.get(message);
  if (/^Input token price must be a non-negative number\.$/.test(message)) return "aiChat.errors.inputPrice";
  if (/^Output token price must be a non-negative number\.$/.test(message)) return "aiChat.errors.outputPrice";
  if (/^Maximum cost must be a non-negative number\.$/.test(message)) return "aiChat.errors.maximumCost";
  if (/This chat has reached .* tokens\. Start a new chat/i.test(message)) return "aiChat.errors.sessionUsageLimit";
  if (/This AI turn stopped after \d[\d,]* PrintForm actions/i.test(message)) return "aiChat.errors.turnActionLimit";
  if (/This AI turn stopped after \d[\d,]* tokens/i.test(message)) return "aiChat.errors.turnTokenLimit";
  if (/This AI turn stopped because printform_/i.test(message)) return "aiChat.errors.repeatedAction";
  if (/Action loop exceeded maxSteps|maximum steps.*terminal output/i.test(message)) return "aiChat.errors.maxStepsExceeded";
  if (/^Passphrase must contain at least \d+ characters$/.test(message)) return "aiChat.errors.passphraseShort";
  return null;
}

export function translateAgentError(error, fallback = "aiChat.errors.generic") {
  const message = messageOf(error);
  const key = CODE_KEYS.get(error?.code) || keyFor(message);
  return key ? t(key) : (message || t(fallback));
}

export function agentErrorKey(error) { return CODE_KEYS.get(error?.code) || keyFor(messageOf(error)); }
