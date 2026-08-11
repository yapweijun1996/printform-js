import { DEFAULT_PROVIDER_PRESET, PUBLIC_GATEWAY_CLIENT_TOKEN } from "./agent-provider.js";

export function populateProviderForm(get, profile = DEFAULT_PROVIDER_PRESET) {
  const item = { ...DEFAULT_PROVIDER_PRESET, ...(profile || {}) };
  const isDefaultGateway = item.id === DEFAULT_PROVIDER_PRESET.id;
  get("#ai-profile-id").value = item.id || "";
  get("#ai-provider").value = item.provider || "openai";
  get("#ai-model").value = item.model || "";
  get("#ai-api-key").value = isDefaultGateway ? "" : item.apiKey || "";
  const gatewayOverride = item.apiKey === PUBLIC_GATEWAY_CLIENT_TOKEN ? "" : item.apiKey || "";
  if (get("#ai-public-gateway-key")) get("#ai-public-gateway-key").value = isDefaultGateway ? gatewayOverride : "";
  get("#ai-endpoint").value = item.endpoint || "";
  get("#ai-api-variant").value = item.apiVariant || "chat";
  get("#ai-input-price").value = item.inputPricePer1M ?? "";
  get("#ai-output-price").value = item.outputPricePer1M ?? "";
  get("#ai-max-cost").value = item.maxCostUsd ?? "";
}
