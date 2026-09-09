import { createModels, createProvider } from "@earendil-works/pi-ai";
import { googleGenerativeAIApi } from "@earendil-works/pi-ai/api/google-generative-ai.lazy";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { openAIResponsesApi } from "@earendil-works/pi-ai/api/openai-responses.lazy";
import { projectProviderParts } from "../ui/agent-provider.js";

const DEFAULT_ENDPOINTS = Object.freeze({
  openai: "https://api.openai.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta"
});

function transportError(code, message) {
  return Object.assign(new Error(message), { code });
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function normalizeEndpoint(endpoint, fallback) {
  const value = String(endpoint || fallback).trim().replace(/\/+$/, "");
  return value.replace(/\/(?:chat\/completions|responses)$/i, "");
}

function providerSpec(profile) {
  if (profile.provider === "gemini") {
    return { id: "pi01-gemini", api: "google-generative-ai", endpoint: normalizeEndpoint(profile.endpoint, DEFAULT_ENDPOINTS.gemini), apiFactory: googleGenerativeAIApi };
  }
  const api = profile.apiVariant === "responses" ? "openai-responses" : "openai-completions";
  return {
    id: profile.provider === "custom" ? "pi01-custom" : "pi01-openai",
    api,
    endpoint: normalizeEndpoint(profile.endpoint, DEFAULT_ENDPOINTS.openai),
    apiFactory: api === "openai-responses" ? openAIResponsesApi : openAICompletionsApi
  };
}

function createModel(profile, spec) {
  const inputPrice = numberOrZero(profile.inputPricePer1M);
  const outputPrice = numberOrZero(profile.outputPricePer1M);
  return {
    id: String(profile.model || "").trim(),
    name: String(profile.model || "").trim(),
    api: spec.api,
    provider: spec.id,
    baseUrl: spec.endpoint,
    reasoning: Boolean(profile.reasoningEffort),
    input: ["text", "image"],
    cost: { input: inputPrice, output: outputPrice, cacheRead: 0, cacheWrite: 0, total: 0 },
    contextWindow: 128000,
    maxTokens: 4096
  };
}

function toImageContent(parts, dataPolicy) {
  return projectProviderParts(parts, { dataPolicy }).map((part) => ({
    type: "image",
    data: part.url.slice(part.url.indexOf(",") + 1),
    mimeType: part.mimeType
  }));
}

function createContext(prompt, parts, dataPolicy) {
  const content = String(prompt || "").slice(0, 12000);
  const images = parts?.length ? toImageContent(parts, dataPolicy) : [];
  return {
    messages: [{ role: "user", content: images.length ? [{ type: "text", text: content }, ...images] : content, timestamp: Date.now() }]
  };
}

function requestSignal(externalSignal, activeControllers) {
  const controller = new AbortController();
  const onAbort = () => controller.abort(externalSignal.reason);
  if (externalSignal) {
    if (externalSignal.aborted) onAbort();
    else externalSignal.addEventListener("abort", onAbort, { once: true });
  }
  activeControllers.add(controller);
  return {
    signal: controller.signal,
    cleanup() {
      externalSignal?.removeEventListener("abort", onAbort);
      activeControllers.delete(controller);
    }
  };
}

function byokAuth(readKey) {
  return {
    apiKey: {
      name: "PrintForm BYOK",
      resolve: async ({ credential, signal }) => {
        signal.throwIfAborted();
        const key = credential?.key || await readKey();
        signal.throwIfAborted();
        return key ? { auth: { apiKey: key }, source: "memory-only BYOK" } : undefined;
      }
    }
  };
}

export function createPiByokAdapter(profile, { apiKey = "", getApiKey = null } = {}) {
  const source = typeof getApiKey === "function" ? getApiKey : () => apiKey;
  const spec = providerSpec(profile);
  const model = createModel(profile, spec);
  if (!model.id) throw transportError("PROVIDER_PROFILE_INVALID", "A model name is required.");
  let activeKey = typeof apiKey === "string" ? apiKey : "";
  let disposed = false;
  const activeControllers = new Set();
  const readKey = async () => {
    if (disposed) throw transportError("BYOK_ADAPTER_DISPOSED", "The BYOK transport has been disposed.");
    const candidate = getApiKey ? await source() : activeKey;
    if (typeof candidate !== "string" || !candidate.trim()) throw transportError("BYOK_REQUIRED", "Unlock the provider vault and supply an API key first.");
    return candidate;
  };
  const provider = createProvider({
    id: spec.id,
    name: `PrintForm ${profile.provider || "OpenAI"}`,
    baseUrl: spec.endpoint,
    auth: byokAuth(readKey),
    models: [model],
    api: { [spec.api]: spec.apiFactory() }
  });
  const models = createModels();
  models.setProvider(provider);

  const optionsFor = (request, key, signal) => ({
    apiKey: key,
    signal,
    maxRetries: request.maxRetries ?? 0,
    ...(request.timeoutMs !== undefined ? { timeoutMs: request.timeoutMs } : {}),
    ...(profile.reasoningEffort ? { reasoning: profile.reasoningEffort } : {}),
    ...(request.onPayload ? { onPayload: request.onPayload } : {}),
    ...(request.onResponse ? { onResponse: request.onResponse } : {})
  });

  return {
    model,
    models,
    async complete(prompt, parts = [], request = {}) {
      const key = await readKey();
      const operation = requestSignal(request.signal, activeControllers);
      try {
        return await models.completeSimple(model, createContext(prompt, parts, request.dataPolicy), optionsFor(request, key, operation.signal));
      } finally {
        operation.cleanup();
      }
    },
    async stream(prompt, parts = [], request = {}) {
      const key = await readKey();
      const operation = requestSignal(request.signal, activeControllers);
      try {
        const stream = models.streamSimple(model, createContext(prompt, parts, request.dataPolicy), optionsFor(request, key, operation.signal));
        void stream.result().finally(operation.cleanup);
        return stream;
      } catch (error) {
        operation.cleanup();
        throw error;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      activeKey = "";
      activeControllers.forEach((controller) => controller.abort());
      activeControllers.clear();
      models.deleteProvider(spec.id);
    }
  };
}

export const PI01_PROVIDER_DEFAULTS = DEFAULT_ENDPOINTS;
