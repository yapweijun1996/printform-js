import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PROVIDER_PRESET, buildProviderInput, chooseDefaultProviderProfile, validateProviderProfile } from "../../studio-v2/ui/agent-provider.js";

function loadAgrun() {
  const source = fs.readFileSync(path.resolve(process.cwd(), "studio-v2/vendor/agrun.min.js"), "utf8");
  const exports = {};
  new Function("exports", "module", source)(exports, { exports });
  return exports;
}
const Agrun = loadAgrun();

function jsonResponse(value) {
  const body = JSON.stringify(value);
  if (typeof Response === "function") return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
  return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => value, text: async () => body };
}

function streamResponse(values) {
  const body = `${values.map((value) => `data: ${JSON.stringify(value)}\n\n`).join("")}data: [DONE]\n\n`;
  if (typeof Response === "function") return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
  return { ok: true, status: 200, headers: { get: () => "text/event-stream" }, body: null, text: async () => body };
}

function mockTransport(response, inspect) {
  const transport = vi.fn(async (url, init = {}) => {
    inspect({ url: String(url), init: { ...init, headers: { ...(init.headers || {}) } } });
    return jsonResponse(response);
  });
  vi.stubGlobal("fetch", transport);
  return transport;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AI Designer provider mocked transport", () => {
  it("defaults to the private gateway Responses profile without embedding a credential", () => {
    expect(DEFAULT_PROVIDER_PRESET).toMatchObject({
      id: "own-gpt-server", provider: "openai", model: "gpt-5.4-mini",
      endpoint: "https://gpt.yapweijun1996.com/v1", apiVariant: "responses", reasoningEffort: "medium"
    });
    expect(DEFAULT_PROVIDER_PRESET).not.toHaveProperty("apiKey");
    expect(chooseDefaultProviderProfile([{ id: "openai-old", provider: "openai" }, DEFAULT_PROVIDER_PRESET])).toBe(DEFAULT_PROVIDER_PRESET);
    expect(buildProviderInput({ ...DEFAULT_PROVIDER_PRESET, apiKey: "gateway-test-key" }, "hello")).toMatchObject({
      provider: "openai", endpoint: "https://gpt.yapweijun1996.com/v1", apiVariant: "responses", reasoningEffort: "medium", model: "gpt-5.4-mini"
    });
  });

  it("sends an OpenAI chat request and parses the assistant response", async () => {
    const apiKey = "openai-test-key";
    const transport = mockTransport({
      id: "mock-openai-response", model: "gpt-mock", choices: [{ index: 0, message: { role: "assistant", content: "mock OpenAI reply" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 }
    }, ({ url, init }) => {
      const body = JSON.parse(init.body);
      expect(url).toBe("https://api.openai.com/v1/chat/completions");
      expect(init.method).toBe("POST");
      expect(init.headers.authorization).toMatch(/^Bearer /);
      expect(body).toMatchObject({ model: "gpt-mock", messages: [{ role: "user", content: "make the heading blue" }] });
      expect(JSON.stringify(body)).not.toContain(apiKey);
    });

    const profile = { provider: "openai", model: "gpt-mock", apiKey, apiVariant: "chat" };
    expect(validateProviderProfile(profile)).toBeNull();
    const result = await Agrun.requestOpenAIChatCompletion(buildProviderInput(profile, "make the heading blue"));
    expect(transport).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ text: "mock OpenAI reply", status: 200 });
    expect(JSON.stringify(result)).not.toContain(apiKey);
  });

  it("sends an OpenAI Responses request and parses output_text", async () => {
    const apiKey = "openai-responses-test-key";
    const transport = mockTransport({
      id: "mock-responses", created_at: 1770000000, model: "gpt-mock",
      output: [{ type: "message", role: "assistant", id: "message-1", content: [{ type: "output_text", text: "mock Responses reply", annotations: [] }] }],
      usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 }
    }, ({ url, init }) => {
      const body = JSON.parse(init.body);
      expect(url).toBe("https://api.openai.com/v1/responses");
      expect(init.method).toBe("POST");
      expect(init.headers.authorization).toMatch(/^Bearer /);
      expect(body).toMatchObject({ model: "gpt-mock", input: [{ role: "user", content: [{ type: "input_text", text: "make the heading blue" }] }] });
      expect(JSON.stringify(body)).not.toContain(apiKey);
    });

    const profile = { provider: "openai", model: "gpt-mock", apiKey, apiVariant: "responses" };
    expect(validateProviderProfile(profile)).toBeNull();
    const input = buildProviderInput(profile, "make the heading blue");
    expect(input.apiVariant).toBe("responses");
    const result = await Agrun.requestOpenAIChatCompletion(input);
    expect(transport).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ text: "mock Responses reply", status: 200, finishReason: "stop" });
    expect(JSON.stringify(result)).not.toContain(apiKey);
  });

  it("sends a redacted layout image as an OpenAI Responses input part", async () => {
    const apiKey = "openai-multimodal-test-key";
    const inspect = vi.fn();
    const transport = vi.fn(async (url, init = {}) => {
      if (String(url).startsWith("data:")) {
        const bytes = Buffer.from(String(url).split(",", 2)[1], "base64");
        return new Response(bytes, { status: 200, headers: { "content-type": "image/svg+xml" } });
      }
      inspect({ url: String(url), init: { ...init, headers: { ...(init.headers || {}) } } });
      return jsonResponse({
      id: "mock-responses-vision", model: "gpt-vision-mock",
      created_at: 1770000000,
      output: [{ type: "message", role: "assistant", id: "message-vision-1", content: [{ type: "output_text", text: "layout reviewed", annotations: [] }] }],
      usage: { input_tokens: 8, output_tokens: 2, total_tokens: 10 }
      });
    });
    vi.stubGlobal("fetch", transport);
    const request = inspect;
    const checkRequest = ({ url, init }) => {
      const body = JSON.parse(init.body);
      expect(url).toBe("https://api.openai.com/v1/responses");
      expect(body.input[0].content).toEqual(expect.arrayContaining([
        { type: "input_text", text: "review layout" },
        expect.objectContaining({ type: "input_image", image_url: expect.stringMatching(/^data:image\//) })
      ]));
      expect(JSON.stringify(body)).not.toContain(apiKey);
    };
    const profile = { provider: "openai", model: "gpt-vision-mock", apiKey, apiVariant: "responses" };
    const result = await Agrun.requestOpenAIChatCompletion(buildProviderInput(profile, "review layout", [{
      type: "image", url: "data:image/svg+xml;base64,PHN2Zz48cmVjdCB3aWR0aD0iMSIgaGVpZ2h0PSIxIi8+PC9zdmc+", mimeType: "image/svg+xml", filename: "layout-default.svg"
    }]));
    checkRequest(request.mock.calls.at(-1)[0]);
    expect(result.text).toBe("layout reviewed");
  });

  it("sends a Gemini generateContent request and parses the model response", async () => {
    const apiKey = "gemini-test-key";
    const transport = mockTransport({
      candidates: [{ content: { role: "model", parts: [{ text: "mock Gemini reply" }] }, finishReason: "STOP" }],
      usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 3, totalTokenCount: 7 }
    }, ({ url, init }) => {
      const body = JSON.parse(init.body);
      expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-mock:generateContent");
      expect(init.method).toBe("POST");
      expect(init.headers["x-goog-api-key"]).toBeTruthy();
      expect(body.contents).toEqual([{ role: "user", parts: [{ text: "make the heading blue" }] }]);
      expect(JSON.stringify(body)).not.toContain(apiKey);
    });

    const profile = { provider: "gemini", model: "gemini-mock", apiKey };
    expect(validateProviderProfile(profile)).toBeNull();
    const result = await Agrun.requestGeminiContent(buildProviderInput(profile, "make the heading blue"));
    expect(transport).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ text: "mock Gemini reply", status: 200 });
    expect(JSON.stringify(result)).not.toContain(apiKey);
  });

  it("maps Custom LLM to an OpenAI-compatible HTTPS endpoint", async () => {
    const apiKey = "custom-test-key";
    const transport = mockTransport({
      id: "mock-custom-response", model: "custom-mock", choices: [{ index: 0, message: { role: "assistant", content: "mock Custom reply" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 }
    }, ({ url, init }) => {
      const body = JSON.parse(init.body);
      expect(url).toBe("https://gateway.example/v1/chat/completions");
      expect(init.headers.authorization).toMatch(/^Bearer /);
      expect(body.model).toBe("custom-mock");
      expect(JSON.stringify(body)).not.toContain(apiKey);
    });

    const profile = { provider: "custom", endpoint: "https://gateway.example/v1", model: "custom-mock", apiKey, apiVariant: "chat" };
    expect(validateProviderProfile(profile)).toBeNull();
    const input = buildProviderInput(profile, "make the heading blue");
    expect(input).toMatchObject({ provider: "openai", endpoint: "https://gateway.example/v1", model: "custom-mock", apiVariant: "chat" });
    const result = await Agrun.requestOpenAIChatCompletion(input);
    expect(transport).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ text: "mock Custom reply", status: 200, endpoint: "https://gateway.example/v1" });
    expect(JSON.stringify(result)).not.toContain(apiKey);
  });

  it("streams planner output through OpenAI SSE transport", async () => {
    const apiKey = "openai-stream-test-key";
    const inspect = vi.fn();
    const transport = vi.fn(async (url, init = {}) => {
      inspect({ url: String(url), init: { ...init, headers: { ...(init.headers || {}) } } });
      const id = "chatcmpl-stream";
      return streamResponse([
        { id, object: "chat.completion.chunk", created: 1770000000, model: "gpt-mock", choices: [{ index: 0, delta: { role: "assistant", content: '{"type":"final","answer":"' }, finish_reason: null }] },
        { id, object: "chat.completion.chunk", created: 1770000000, model: "gpt-mock", choices: [{ index: 0, delta: { content: "streamed reply" }, finish_reason: null }] },
        { id, object: "chat.completion.chunk", created: 1770000000, model: "gpt-mock", choices: [{ index: 0, delta: { content: '"}' }, finish_reason: null }] },
        { id, object: "chat.completion.chunk", created: 1770000000, model: "gpt-mock", choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 3, completion_tokens: 5, total_tokens: 8 } }
      ]);
    });
    vi.stubGlobal("fetch", transport);

    const runtime = Agrun.createRuntime({ sessionStore: Agrun.createInMemorySessionStore(), globalMemory: { enabled: false }, customActions: [], actionPolicy: {}, maxSteps: 4 });
    const session = await runtime.createSession({ id: "transport-stream-test" });
    const events = [];
    const tokens = [];
    const stream = session.runStream({ provider: "openai", apiKey, model: "gpt-mock", apiVariant: "chat", prompt: "hello" }, {
      onToken: (token) => tokens.push(typeof token === "string" ? token : token?.text || ""),
      onStreamEvent: (event) => events.push(event)
    });
    for await (const event of stream) events.push(event);

    const completed = events.find((event) => event.type === "completed");
    const providerEvents = events.map((event) => event.type).filter((type) => type.startsWith("provider-"));
    const request = inspect.mock.calls[0]?.[0];
    expect(transport).toHaveBeenCalledOnce();
    expect(request.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(JSON.parse(request.init.body)).toMatchObject({ model: "gpt-mock", stream: true });
    expect(tokens.join("")).toContain("streamed reply");
    expect(providerEvents).toEqual(expect.arrayContaining(["provider-stream-start", "provider-text-delta", "provider-stream-finish"]));
    expect(completed?.detail).toMatchObject({ terminalKind: "done", result: { output: { kind: "planner_final", text: "streamed reply" } } });
    expect(JSON.stringify(events)).not.toContain(apiKey);
  });

  it("streams planner output through the gateway Responses SSE transport", async () => {
    const apiKey = "gateway-responses-stream-test-key";
    const inspect = vi.fn();
    const transport = vi.fn(async (url, init = {}) => {
      inspect({ url: String(url), init: { ...init, headers: { ...(init.headers || {}) } } });
      return streamResponse([
        { type: "response.created", response: { id: "resp-stream", created_at: 1770000000, model: "gpt-5.4-mini" } },
        { type: "response.output_item.added", output_index: 0, item: { type: "message", id: "message-stream", phase: "final_answer" } },
        { type: "response.output_text.delta", item_id: "message-stream", delta: '{"type":"final","answer":"' },
        { type: "response.output_text.delta", item_id: "message-stream", delta: "gateway streamed reply" },
        { type: "response.output_text.delta", item_id: "message-stream", delta: '"}' },
        { type: "response.output_item.done", output_index: 0, item: { type: "message", id: "message-stream", phase: "final_answer" } },
        { type: "response.completed", response: { usage: { input_tokens: 3, output_tokens: 5, total_tokens: 8 } } }
      ]);
    });
    vi.stubGlobal("fetch", transport);

    const runtime = Agrun.createRuntime({ sessionStore: Agrun.createInMemorySessionStore(), globalMemory: { enabled: false }, customActions: [], actionPolicy: {}, maxSteps: 4 });
    const session = await runtime.createSession({ id: "gateway-responses-stream-test" });
    const events = [];
    const tokens = [];
    const stream = session.runStream({ endpoint: "https://gpt.yapweijun1996.com/v1", provider: "openai", apiKey, model: "gpt-5.4-mini", apiVariant: "responses", reasoningEffort: "medium", prompt: "hello" }, {
      onToken: (token) => tokens.push(typeof token === "string" ? token : token?.text || ""),
      onStreamEvent: (event) => events.push(event)
    });
    for await (const event of stream) events.push(event);

    const request = inspect.mock.calls[0]?.[0];
    expect(transport).toHaveBeenCalledOnce();
    expect(request.url).toBe("https://gpt.yapweijun1996.com/v1/responses");
    expect(JSON.parse(request.init.body)).toMatchObject({ model: "gpt-5.4-mini", stream: true });
    expect(JSON.parse(request.init.body)).toMatchObject({ reasoning: { effort: "medium" } });
    expect(JSON.parse(request.init.body)).not.toHaveProperty("temperature");
    expect(tokens.join("")).toContain("gateway streamed reply");
    expect(events.map((event) => event.type)).toEqual(expect.arrayContaining(["provider-stream-start", "provider-text-delta", "provider-stream-finish"]));
    expect(JSON.stringify(events)).not.toContain(apiKey);
  });

  it("propagates abort to an in-flight OpenAI transport", async () => {
    const controller = new AbortController();
    let requestSignal;
    const transport = vi.fn((url, init = {}) => {
      requestSignal = init.signal;
      return new Promise((_resolve, reject) => {
        const abort = () => reject(Object.assign(new Error("aborted by test"), { name: "AbortError" }));
        if (requestSignal?.aborted) abort();
        else requestSignal?.addEventListener("abort", abort, { once: true });
      });
    });
    vi.stubGlobal("fetch", transport);

    const pending = Agrun.requestOpenAIChatCompletion({ provider: "openai", model: "gpt-mock", apiKey: "openai-abort-test-key", apiVariant: "chat", prompt: "wait", signal: controller.signal, timeoutMs: 5000 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();

    await expect(pending).rejects.toMatchObject({ message: "aborted by test" });
    expect(transport).toHaveBeenCalledOnce();
    expect(requestSignal).not.toBe(controller.signal);
    expect(requestSignal.aborted).toBe(true);
  });

  it("propagates abort to an in-flight gateway Responses transport", async () => {
    const controller = new AbortController();
    let requestSignal;
    const transport = vi.fn((url, init = {}) => {
      requestSignal = init.signal;
      return new Promise((_resolve, reject) => {
        const abort = () => reject(Object.assign(new Error("gateway response aborted by test"), { name: "AbortError" }));
        if (requestSignal?.aborted) abort();
        else requestSignal?.addEventListener("abort", abort, { once: true });
      });
    });
    vi.stubGlobal("fetch", transport);

    const pending = Agrun.requestOpenAIChatCompletion({ endpoint: "https://gpt.yapweijun1996.com/v1", provider: "openai", model: "gpt-5.4-mini", apiKey: "gateway-responses-abort-key", apiVariant: "responses", prompt: "wait", signal: controller.signal, timeoutMs: 5000 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();

    await expect(pending).rejects.toMatchObject({ message: "gateway response aborted by test" });
    expect(transport).toHaveBeenCalledOnce();
    expect(requestSignal).not.toBe(controller.signal);
    expect(requestSignal.aborted).toBe(true);
  });
});
