import {
  DEFAULT_PROVIDER_PRESET,
  isDefaultGatewayProfile,
  publicDefaultProviderProfile
} from "./agent-provider.js";

export function gatewayProfileFromForm(get) {
  const item = {
    id: get("#ai-profile-id").value.trim(),
    provider: get("#ai-provider").value,
    model: get("#ai-model").value.trim(),
    apiKey: get("#ai-api-key").value,
    endpoint: get("#ai-endpoint").value.trim(),
    apiVariant: get("#ai-api-variant").value,
    inputPricePer1M: get("#ai-input-price").value,
    outputPricePer1M: get("#ai-output-price").value,
    maxCostUsd: get("#ai-max-cost").value
  };
  const isDefaultGateway = isDefaultGatewayProfile(item);
  const gatewayKey = isDefaultGateway ? get("#ai-public-gateway-key").value.trim() : "";
  return {
    isDefaultGateway,
    gatewayKey,
    profile: isDefaultGateway ? publicDefaultProviderProfile(gatewayKey) : item,
    item: isDefaultGateway ? { ...item, apiKey: gatewayKey } : item
  };
}

export function gatewayOptionLabel(t, hasToken) {
  return t(hasToken ? "aiSettings.runtime.defaultGatewaySession" : "aiSettings.runtime.defaultGatewayPublic", { model: DEFAULT_PROVIDER_PRESET.model });
}

export function gatewayBadgeKey(hasToken) {
  return hasToken ? "aiSettings.sessionGateway" : "aiSettings.publicGateway";
}

export function gatewayStatusKey(hasToken) {
  return hasToken ? "aiChat.status.sessionGateway" : "aiChat.status.publicGateway";
}
