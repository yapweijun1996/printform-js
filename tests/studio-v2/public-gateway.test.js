import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PROVIDER_PRESET,
  buildProviderInput,
  isCredentialFreeDefaultGatewayProfile,
  publicDefaultProviderProfile,
  validateProviderProfile
} from "../../studio-v2/ui/agent-provider.js";
import { DEMO_GATEWAY_ENDPOINT, DEMO_GATEWAY_PROJECT_ID, resetDefaultDemoGatewaySession } from "../../studio-v2/ui/agent-demo-gateway.js";

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
  resetDefaultDemoGatewaySession();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("browser demo gateway", () => {
  it("uses a credential-free demo profile by default", () => {
    const profile = publicDefaultProviderProfile();
    expect(validateProviderProfile(profile)).toBeNull();
    expect(isCredentialFreeDefaultGatewayProfile(profile)).toBe(true);
    const input = buildProviderInput(profile, "hello");
    expect(input).toMatchObject({
      provider: "openai",
      authMode: "server",
      endpoint: `${DEMO_GATEWAY_ENDPOINT}/responses`,
      model: "gpt-5.4-mini",
      apiVariant: "responses",
      reasoningEffort: "medium",
      prompt: "hello"
    });
    expect(input).not.toHaveProperty("apiKey");
    expect(publicDefaultProviderProfile("gw-test-key")).not.toHaveProperty("apiKey");
    expect(DEFAULT_PROVIDER_PRESET).not.toHaveProperty("apiKey");
  });

  it("rejects a gateway key on the browser Demo profile", () => {
    expect(validateProviderProfile({ ...publicDefaultProviderProfile(), apiKey: "gw-test-key" })).toContain("does not accept");
    expect(validateProviderProfile({ provider: "openai", model: "gpt-test", apiVariant: "responses" })).toContain("API key");
  });

  it("rejects geometry-only SVG evidence for the restricted Demo media contract", () => {
    expect(() => buildProviderInput(publicDefaultProviderProfile(), "review layout", [{
      type: "image",
      url: "data:image/svg+xml;base64,PHN2Zz48cmVjdCB3aWR0aD0iMSIgaGVpZ2h0PSIxIi8+PC9zdmc+",
      mimeType: "image/svg+xml",
      filename: "layout.svg",
      source: "geometry-only",
      redacted: true
    }])).toThrowError(/only PNG, JPEG or WebP/);
  });

  it("issues a demo session before the final Responses request", async () => {
    const requests = [];
    vi.stubGlobal("fetch", async (url, init = {}) => {
      requests.push({ url: String(url), init: { ...init, headers: new Headers(init.headers || {}) } });
      if (String(url).endsWith("/demo/session")) return new Response(JSON.stringify({ token: "dmo_test-token", expires_in: 900 }), { status: 200, headers: { "content-type": "application/json" } });
      return new Response(JSON.stringify({
        id: "public-response",
        created_at: 1770000000,
        model: "gpt-5.4-mini",
        output: [{ type: "message", role: "assistant", id: "message-1", content: [{ type: "output_text", text: "public reply", annotations: [] }] }]
      }), { status: 200, headers: { "content-type": "application/json" } });
    });

    const input = buildProviderInput(publicDefaultProviderProfile(), "hello");
    const result = await Agrun.requestOpenAIChatCompletion(input, input.fetch);
    const sessionRequest = requests[0];
    const providerRequest = requests[1];
    expect(sessionRequest.url).toBe("https://gpt.yapweijun1996.com/demo/session");
    expect(sessionRequest.init.headers.get("authorization")).toBeNull();
    expect(JSON.parse(sessionRequest.init.body)).toEqual({ project_id: DEMO_GATEWAY_PROJECT_ID });
    expect(providerRequest.url).toBe(`${DEMO_GATEWAY_ENDPOINT}/responses`);
    expect(providerRequest.init.headers.get("authorization")).toBe("Bearer dmo_test-token");
    expect(JSON.parse(providerRequest.init.body)).toMatchObject({ model: "gpt-5.4-mini", reasoning: { effort: "medium" } });
    expect(result.text).toBe("public reply");
  });

  it("streams through the demo endpoint with the in-memory session", async () => {
    const requests = [];
    vi.stubGlobal("fetch", async (url, init = {}) => {
      requests.push({ url: String(url), init: { ...init, headers: new Headers(init.headers || {}) } });
      if (String(url).endsWith("/demo/session")) return new Response(JSON.stringify({ token: "dmo_stream-token", expires_in: 900 }), { status: 200, headers: { "content-type": "application/json" } });
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
    const input = buildProviderInput(publicDefaultProviderProfile(), "hello");
    for await (const event of session.runStream(input, { onToken: (token) => tokens.push(typeof token === "string" ? token : token?.text || ""), onStreamEvent: (event) => events.push(event) })) events.push(event);
    expect(requests).toHaveLength(2);
    expect(requests[1].url).toBe(`${DEMO_GATEWAY_ENDPOINT}/responses`);
    expect(requests[1].init.headers.get("authorization")).toBe("Bearer dmo_stream-token");
    expect(tokens.join("")).toContain("public stream");
    expect(events.map((event) => event.type)).toEqual(expect.arrayContaining(["provider-stream-start", "provider-text-delta", "provider-stream-finish"]));
  });
});
