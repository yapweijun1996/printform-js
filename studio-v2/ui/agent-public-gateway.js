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
  return {
    isDefaultGateway,
    profile: isDefaultGateway ? publicDefaultProviderProfile() : item,
    item: isDefaultGateway ? { ...item, apiKey: "" } : item
  };
}

export function gatewayOptionLabel(t) {
  return t("aiSettings.runtime.defaultGatewayDemo", { model: DEFAULT_PROVIDER_PRESET.model });
}

export function gatewayBadgeKey() {
  return "aiSettings.publicGateway";
}

export function gatewayStatusKey() {
  return "aiChat.status.demoGateway";
}
