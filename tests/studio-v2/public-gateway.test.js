import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PROVIDER_PRESET,
  PUBLIC_GATEWAY_CLIENT_TOKEN,
  buildProviderInput,
  isCredentialFreeDefaultGatewayProfile,
  publicDefaultProviderProfile,
  validateProviderProfile
} from "../../studio-v2/ui/agent-provider.js";

function loadAgrun() {
  const source = fs.readFileSync(path.resolve(process.cwd(), "studio-v2/vendor/agrun.min.js"), "utf8");
  const exports = {};
  new Function("exports", "module", source)(exports, { exports });
  return exports;
}

const Agrun = loadAgrun();

function streamResponse(values) {
  const body = `${values.map((value) => `data: ${JSON.stringify(value)}\n\n`).join("")}data: [DONE]\n\n`;
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("public own gateway", () => {
  it("uses the intentionally public built-in credential by default", () => {
    const profile = publicDefaultProviderProfile();
    expect(validateProviderProfile(profile)).toBeNull();
    expect(isCredentialFreeDefaultGatewayProfile(profile)).toBe(false);
    const input = buildProviderInput(profile, "hello");
    expect(input.apiKey === PUBLIC_GATEWAY_CLIENT_TOKEN).toBe(true);
    expect({ ...input, apiKey: "[public credential]" }).toEqual({
      provider: "openai",
      apiKey: "[public credential]",
      endpoint: "https://gpt.yapweijun1996.com/v1",
      model: "gpt-5.4-mini",
      apiVariant: "responses",
      reasoningEffort: "medium",
      prompt: "hello"
    });
    expect(PUBLIC_GATEWAY_CLIENT_TOKEN).toMatch(/^gw_[a-z0-9]+$/);
    expect(publicDefaultProviderProfile("   ").apiKey === PUBLIC_GATEWAY_CLIENT_TOKEN).toBe(true);
    expect(DEFAULT_PROVIDER_PRESET).not.toHaveProperty("apiKey");
  });

  it("keeps BYOK validation for non-public profiles", () => {
    expect(validateProviderProfile({ provider: "openai", model: "gpt-test", apiVariant: "responses" })).toContain("API key");
    expect(isCredentialFreeDefaultGatewayProfile({ ...publicDefaultProviderProfile(), apiKey: "stored-key" })).toBe(false);
  });

  it("supports a session-only gateway token without server-auth mode", () => {
    const profile = publicDefaultProviderProfile("session-test-key");
    const input = buildProviderInput(profile, "hello");
    expect(validateProviderProfile(profile)).toBeNull();
    expect(input).toMatchObject({
      provider: "openai", apiKey: "session-test-key", endpoint: "https://gpt.yapweijun1996.com/v1",
      model: "gpt-5.4-mini", apiVariant: "responses", reasoningEffort: "medium"
    });
    expect(input.authMode).toBeUndefined();
  });

  it("sends the built-in credential through the Responses transport", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", async (url, init = {}) => {
      request({ url: String(url), init: { ...init, headers: { ...(init.headers || {}) } } });
      return new Response(JSON.stringify({
        id: "public-response",
        created_at: 1770000000,
        model: "gpt-5.4-mini",
        output: [{ type: "message", role: "assistant", id: "message-1", content: [{ type: "output_text", text: "public reply", annotations: [] }] }]
      }), { status: 200, headers: { "content-type": "application/json" } });
    });

    const result = await Agrun.requestOpenAIChatCompletion(buildProviderInput(publicDefaultProviderProfile(), "hello"));
    const call = request.mock.calls[0][0];
    expect(call.url).toBe("https://gpt.yapweijun1996.com/v1/responses");
    expect(call.init.headers.authorization === `Bearer ${PUBLIC_GATEWAY_CLIENT_TOKEN}`).toBe(true);
    expect(JSON.parse(call.init.body)).toMatchObject({ model: "gpt-5.4-mini", reasoning: { effort: "medium" } });
    expect(result.text).toBe("public reply");
  });

  it("streams with the built-in public credential", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", async (url, init = {}) => {
      request({ url: String(url), init: { ...init, headers: { ...(init.headers || {}) } } });
      return streamResponse([
        { type: "response.created", response: { id: "public-stream", created_at: 1770000000, model: "gpt-5.4-mini" } },
        { type: "response.output_item.added", output_index: 0, item: { type: "message", id: "public-message", phase: "final_answer" } },
        { type: "response.output_text.delta", item_id: "public-message", delta: '{"type":"final","answer":"public stream"}' },
        { type: "response.output_item.done", output_index: 0, item: { type: "message", id: "public-message", phase: "final_answer" } },
        { type: "response.completed", response: { usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3 } } }
      ]);
    });
    const runtime = Agrun.createRuntime({ sessionStore: Agrun.createInMemorySessionStore(), globalMemory: { enabled: false }, customActions: [], actionPolicy: {}, maxSteps: 4 });
    const session = await runtime.createSession({ id: "public-gateway-stream" });
    const events = [];
    const tokens = [];
    for await (const event of session.runStream(buildProviderInput(publicDefaultProviderProfile(), "hello"), { onToken: (token) => tokens.push(typeof token === "string" ? token : token?.text || ""), onStreamEvent: (event) => events.push(event) })) events.push(event);
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0][0].url).toBe("https://gpt.yapweijun1996.com/v1/responses");
    expect(request.mock.calls[0][0].init.headers.authorization === `Bearer ${PUBLIC_GATEWAY_CLIENT_TOKEN}`).toBe(true);
    expect(tokens.join("")).toContain("public stream");
    expect(events.map((event) => event.type)).toEqual(expect.arrayContaining(["provider-stream-start", "provider-text-delta", "provider-stream-finish"]));
  });
});
