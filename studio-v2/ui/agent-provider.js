const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const RECIPIENT_FIELDS = ["id", "provider", "model", "endpoint", "apiVariant", "apiKey", "authMode"];
// This identity stays in memory; never persist or include credential fields in diagnostics.
export function captureProviderRecipient(profile) {
  return profile ? Object.fromEntries(RECIPIENT_FIELDS.map((key) => [key, profile[key] ?? ""])) : null;
}
export function isProviderRecipientCurrent(expected, profile) {
  if (!expected || !profile) return !expected && !profile;
  return RECIPIENT_FIELDS.every((key) => expected[key] === (profile[key] ?? ""));
}

/**
 * Intentionally public browser credential for the owner-operated Gateway.
 * It ships in source/build and is extractable by every Studio user. The
 * Gateway must enforce quotas, abuse controls, rotation and origin policy.
 */
export const PUBLIC_GATEWAY_CLIENT_TOKEN = "gw_524fa12f91c74c0aa21d73fbaa7b97a27a7db3b5a6b33708";

export const DEFAULT_PROVIDER_PRESET = Object.freeze({
  id: "own-gpt-server",
  provider: "openai",
  model: "gpt-5.4-mini",
  endpoint: "https://gpt.yapweijun1996.com/v1",
  apiVariant: "responses",
  reasoningEffort: "medium",
  inputPricePer1M: "",
  outputPricePer1M: "",
  maxCostUsd: ""
});

function normalizedEndpoint(endpoint) {
  return String(endpoint || "").trim().replace(/\/+$/, "");
}

export function isCredentialFreeDefaultGatewayProfile(profile = {}) {
  return isDefaultGatewayProfile(profile) && !profile.apiKey?.trim();
}

export function isDefaultGatewayProfile(profile = {}) {
  const endpoint = normalizedEndpoint(profile.endpoint);
  const defaultEndpoint = normalizedEndpoint(DEFAULT_PROVIDER_PRESET.endpoint);
  return profile.id === DEFAULT_PROVIDER_PRESET.id && profile.provider === "openai" &&
    (endpoint === defaultEndpoint || endpoint === `${defaultEndpoint}/responses`) &&
    profile.apiVariant === DEFAULT_PROVIDER_PRESET.apiVariant;
}

export function publicDefaultProviderProfile(apiKey = "") {
  const key = String(apiKey || "").trim() || PUBLIC_GATEWAY_CLIENT_TOKEN;
  return { ...DEFAULT_PROVIDER_PRESET, apiKey: key };
}

function responsesEndpoint(endpoint) {
  const normalized = normalizedEndpoint(endpoint);
  return normalized.endsWith("/responses") ? normalized : `${normalized}/responses`;
}

export function chooseDefaultProviderProfile(profiles = []) {
  return profiles.find((profile) => profile.id === DEFAULT_PROVIDER_PRESET.id) || profiles[0] || null;
}

function optionalNonNegativeNumber(value, label) {
  if (value === undefined || value === null || value === "") return { value: null };
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return { error: `${label} must be a non-negative number.` };
  return { value: number };
}

export function isSafeProviderEndpoint(endpoint) {
  if (!endpoint) return true;
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" || (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname));
  } catch {
    return false;
  }
}

export function validateProviderProfile(profile) {
  if (!profile || !["openai", "gemini", "custom"].includes(profile.provider)) return "Choose OpenAI, Gemini or Custom LLM.";
  if (!profile.model?.trim()) return "A model name is required.";
  if (isCredentialFreeDefaultGatewayProfile(profile)) return "A current-session Gateway token is required.";
  if (!profile.apiKey?.trim()) return "An API key is required.";
  if (profile.provider === "custom" && !profile.endpoint?.trim()) return "Custom LLM requires an HTTPS or localhost endpoint.";
  if (!isSafeProviderEndpoint(profile.endpoint)) return "Provider endpoint must use HTTPS, or HTTP on localhost only.";
  if (!["chat", "responses"].includes(profile.apiVariant || "chat")) return "API variant must be chat or responses.";
  const inputPrice = optionalNonNegativeNumber(profile.inputPricePer1M, "Input token price");
  const outputPrice = optionalNonNegativeNumber(profile.outputPricePer1M, "Output token price");
  const maxCost = optionalNonNegativeNumber(profile.maxCostUsd, "Maximum cost");
  if (inputPrice.error) return inputPrice.error;
  if (outputPrice.error) return outputPrice.error;
  if (maxCost.error) return maxCost.error;
  if ((inputPrice.value === null) !== (outputPrice.value === null)) return "Provide both input and output token prices, or leave both blank.";
  if (maxCost.value !== null && maxCost.value <= 0) return "Maximum cost must be greater than zero when provided.";
  return null;
}

export function buildRuntimeBudget(profile) {
  const input = optionalNonNegativeNumber(profile?.inputPricePer1M, "Input token price").value;
  const output = optionalNonNegativeNumber(profile?.outputPricePer1M, "Output token price").value;
  const maxCostUsd = optionalNonNegativeNumber(profile?.maxCostUsd, "Maximum cost").value;
  const priced = input !== null && output !== null;
  if (!priced) return { priced: false, costPricing: undefined, maxCostUsd: undefined };
  const provider = profile.provider === "custom" ? "openai" : profile.provider;
  return {
    priced: true,
    costPricing: { [`${provider}:${profile.model}`]: { input, output, currency: "USD", per: 1_000_000 } },
    maxCostUsd: maxCostUsd > 0 ? maxCostUsd : undefined
  };
}

const PROVIDER_PART_KEYS = new Set(["type", "url", "mimeType", "filename", "source", "syntheticData", "redacted"]);
const IMAGE_MIME_PATTERN = /^image\/(?:png|jpeg|webp|svg\+xml)$/i;
const DATA_IMAGE_PATTERN = /^data:image\/(?:png|jpeg|webp|svg\+xml);base64,[a-z0-9+/=]+$/i;

function providerPayloadError(message) {
  return Object.assign(new Error(message), { code: "PROVIDER_PAYLOAD_INVALID" });
}

export function projectProviderParts(parts = [], { dataPolicy = null } = {}) {
  if (!Array.isArray(parts)) throw providerPayloadError("Provider parts must be an array.");
  if (parts.length > 16) throw providerPayloadError("Provider payload contains too many media parts.");
  return parts.map((part) => {
    if (!part || part.type !== "image" || typeof part.url !== "string" || !DATA_IMAGE_PATTERN.test(part.url)) {
      throw providerPayloadError("Only validated inline image evidence may enter the Provider payload.");
    }
    if (Object.keys(part).some((key) => !PROVIDER_PART_KEYS.has(key))) throw providerPayloadError("Provider media metadata contains an unknown field.");
    const mimeType = String(part.mimeType || part.url.slice(5, part.url.indexOf(";"))).toLowerCase();
    if (!IMAGE_MIME_PATTERN.test(mimeType)) throw providerPayloadError("Provider media evidence has an unsupported image type.");
    const filename = String(part.filename || "evidence").replace(/[^a-z0-9._-]/gi, "_").slice(0, 120);
    const pixelPart = mimeType !== "image/svg+xml" || /\.(?:png|jpe?g|webp)$/i.test(filename);
    const validPixelProvenance = pixelPart && part.source === "sandbox-pixel" && part.syntheticData === true && part.redacted === false;
    const validGeometryProvenance = !pixelPart && mimeType === "image/svg+xml" && part.source === "geometry-only" && part.redacted === true;
    if (dataPolicy && !validGeometryProvenance && !validPixelProvenance) throw providerPayloadError("Provider media evidence provenance is invalid.");
    if (dataPolicy?.allowPixelEvidence === false && !validGeometryProvenance) throw providerPayloadError("Pixel evidence is blocked by the current data policy.");
    return { type: "image", url: part.url, mimeType, filename };
  });
}

export function buildProviderInput(profile, prompt, parts = [], { dataPolicy = null } = {}) {
  const provider = profile.provider === "custom" ? "openai" : profile.provider;
  const credentialFreeGateway = isCredentialFreeDefaultGatewayProfile(profile);
  const input = { provider, model: profile.model, prompt: String(prompt || "").slice(0, 12000) };
  if (credentialFreeGateway) {
    input.authMode = "server";
    input.endpoint = responsesEndpoint(profile.endpoint);
  } else {
    input.apiKey = profile.apiKey;
    if (profile.endpoint) input.endpoint = profile.endpoint;
  }
  if (provider === "openai") {
    input.apiVariant = profile.apiVariant || "chat";
    const usesOwnResponsesGateway = input.apiVariant === "responses" && profile.endpoint === DEFAULT_PROVIDER_PRESET.endpoint;
    const reasoningEffort = profile.reasoningEffort || (usesOwnResponsesGateway ? DEFAULT_PROVIDER_PRESET.reasoningEffort : "");
    if (reasoningEffort) input.reasoningEffort = reasoningEffort;
  }
  if (parts.length) input.parts = projectProviderParts(parts, { dataPolicy });
  return input;
}
