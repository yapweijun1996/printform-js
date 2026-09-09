import { classifyImportedDocument } from "../core/data-policy.js";
import { getDefaultDemoGatewaySession } from "./agent-demo-gateway.js";

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

export const DEFAULT_PROVIDER_PRESET = Object.freeze({
  id: "own-gpt-server",
  provider: "openai",
  model: "gpt-5.4-mini",
  endpoint: "https://gpt.yapweijun1996.com/demo/v1",
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

export function publicDefaultProviderProfile() {
  return { ...DEFAULT_PROVIDER_PRESET };
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
  if (isDefaultGatewayProfile(profile) && profile.apiKey?.trim()) return "The browser Demo gateway does not accept a gateway key.";
  if (!isCredentialFreeDefaultGatewayProfile(profile) && !profile.apiKey?.trim()) return "An API key is required.";
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

function createPolicyGuardedFetch(assertCurrentPolicy = () => {}, demoGatewaySession = null) {
  const assertBoundary = () => {
    try {
      assertCurrentPolicy();
    } catch (error) {
      const guarded = Object.assign(new Error(error?.message || "The Agent policy is no longer current"), {
        code: error?.code || "STALE_POLICY_CONTEXT",
        debug: { code: error?.code || "STALE_POLICY_CONTEXT" }
      });
      throw guarded;
    }
  };
  return async (request, options) => {
    assertBoundary();
    const fetchImpl = globalThis.fetch;
    if (typeof fetchImpl !== "function") throw providerPayloadError("Provider transport is unavailable.");
    const response = demoGatewaySession
      ? await demoGatewaySession.fetch(request, options)
      : await fetchImpl(request, options);
    assertBoundary();
    return response;
  };
}

export function projectProviderParts(parts = [], { dataPolicy = null } = {}) {
  const effectivePolicy = dataPolicy || classifyImportedDocument();
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
    if (!validGeometryProvenance && !validPixelProvenance) throw providerPayloadError("Provider media evidence provenance is invalid.");
    if (effectivePolicy.allowPixelEvidence === false && !validGeometryProvenance) throw providerPayloadError("Pixel evidence is blocked by the current data policy.");
    return { type: "image", url: part.url, mimeType, filename };
  });
}

export function buildProviderInput(profile, prompt, parts = [], { dataPolicy = null, assertCurrentPolicy = null, demoGatewaySession = null } = {}) {
  const effectivePolicy = dataPolicy || classifyImportedDocument();
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
    const usesOwnResponsesGateway = input.apiVariant === "responses" && normalizedEndpoint(profile.endpoint) === normalizedEndpoint(DEFAULT_PROVIDER_PRESET.endpoint);
    const reasoningEffort = profile.reasoningEffort || (usesOwnResponsesGateway ? DEFAULT_PROVIDER_PRESET.reasoningEffort : "");
    if (reasoningEffort) input.reasoningEffort = reasoningEffort;
  }
  if (parts.length) {
    const projectedParts = projectProviderParts(parts, { dataPolicy: effectivePolicy });
    if (credentialFreeGateway && projectedParts.some((part) => part.mimeType === "image/svg+xml")) {
      throw providerPayloadError("The browser Demo Gateway accepts only PNG, JPEG or WebP evidence.");
    }
    input.parts = projectedParts;
  }
  if (credentialFreeGateway || typeof assertCurrentPolicy === "function") {
    input.fetch = createPolicyGuardedFetch(assertCurrentPolicy || (() => {}), credentialFreeGateway ? (demoGatewaySession || getDefaultDemoGatewaySession()) : null);
  }
  return input;
}
