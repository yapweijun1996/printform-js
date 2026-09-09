import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildProviderInput, projectProviderParts } from "../../studio-v2/ui/agent-provider.js";
import { AGRUN_VENDOR_PROVENANCE } from "../../studio-v2/vendor/agrun.provenance.js";

function loadAgrun() {
  const source = fs.readFileSync(path.resolve(process.cwd(), "studio-v2/vendor/agrun.min.js"), "utf8");
  const exports = {};
  new Function("exports", "module", source)(exports, { exports });
  return exports;
}

function jsonResponse(value) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AI Designer inline media transport", () => {
  it("keeps the vendored hash, provenance and script integrity synchronized", () => {
    const bytes = fs.readFileSync(path.resolve(process.cwd(), "studio-v2/vendor/agrun.min.js"));
    const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    const sri = `sha256-${crypto.createHash("sha256").update(bytes).digest("base64")}`;
    const html = fs.readFileSync(path.resolve(process.cwd(), "studio-v2/index.html"), "utf8");

    expect(AGRUN_VENDOR_PROVENANCE.sha256).toBe(sha256);
    expect(AGRUN_VENDOR_PROVENANCE.sri).toBe(sri);
    expect(AGRUN_VENDOR_PROVENANCE.upstreamSha256).toBe(sha256);
    expect(AGRUN_VENDOR_PROVENANCE.patches).toEqual([]);
    expect(html).toContain(`integrity="${sri}"`);
  });

  it("defaults a missing policy to restrictive Unknown for pixel media", () => {
    const profile = { provider: "openai", model: "gpt-vision-mock", apiKey: "media-policy-key", apiVariant: "responses" };
    expect(() => buildProviderInput(profile, "review layout", [{
      type: "image",
      url: "data:image/png;base64,AAAA",
      mimeType: "image/png",
      filename: "layout.png",
      source: "sandbox-pixel",
      syntheticData: true,
      redacted: false
    }])).toThrowError(/Pixel evidence/);
  });

  it("keeps the exported media projection restrictive without a policy argument", () => {
    expect(() => projectProviderParts([{
      type: "image",
      url: "data:image/png;base64,AAAA",
      mimeType: "image/png",
      filename: "layout.png",
      source: "untrusted-pixel",
      syntheticData: true,
      redacted: false
    }])).toThrowError(/provenance/);
  });

  it("checks the current policy at the final provider transport boundary", async () => {
    const Agrun = loadAgrun();
    const transport = vi.fn();
    vi.stubGlobal("fetch", transport);
    let current = true;
    const assertCurrentPolicy = vi.fn(() => {
      if (!current) throw Object.assign(new Error("The Agent policy changed before provider send"), { code: "STALE_POLICY_CONTEXT" });
    });
    const input = buildProviderInput({ provider: "openai", model: "gpt-mock", apiKey: "transport-policy-key", apiVariant: "chat" }, "review", [], { assertCurrentPolicy });
    current = false;

    await expect(Agrun.requestOpenAIChatCompletion(input, input.fetch)).rejects.toMatchObject({ code: "STALE_POLICY_CONTEXT" });
    expect(assertCurrentPolicy).toHaveBeenCalledOnce();
    expect(transport).not.toHaveBeenCalled();
  });

  it("rejects a response that completes after the policy becomes stale", async () => {
    const Agrun = loadAgrun();
    let release;
    const transport = vi.fn(() => new Promise((resolve) => { release = () => resolve(jsonResponse({ choices: [{ message: { content: "stale" } }] })); }));
    vi.stubGlobal("fetch", transport);
    let current = true;
    const assertCurrentPolicy = () => {
      if (!current) throw Object.assign(new Error("The Agent policy changed after provider send"), { code: "STALE_POLICY_CONTEXT" });
    };
    const input = buildProviderInput({ provider: "openai", model: "gpt-mock", apiKey: "response-policy-key", apiVariant: "chat" }, "review", [], { assertCurrentPolicy });
    const pending = Agrun.requestOpenAIChatCompletion(input, input.fetch);
    await new Promise((resolve) => setTimeout(resolve, 0));
    current = false;
    release();

    await expect(pending).rejects.toMatchObject({ code: "STALE_POLICY_CONTEXT" });
    expect(transport).toHaveBeenCalledOnce();
  });

  it("sends data images inline without downloading them first", async () => {
    const Agrun = loadAgrun();
    const providerRequests = [];
    const transport = vi.fn(async (url, init = {}) => {
      if (String(url).startsWith("data:")) throw new Error("data URLs must not be downloaded");
      providerRequests.push({ url: String(url), body: JSON.parse(init.body) });
      return jsonResponse({
        id: "mock-vision-response",
        created_at: 1770000000,
        model: "gpt-vision-mock",
        output: [{
          type: "message",
          role: "assistant",
          id: "message-vision-1",
          content: [{ type: "output_text", text: "layout reviewed", annotations: [] }]
        }],
        usage: { input_tokens: 8, output_tokens: 2, total_tokens: 10 }
      });
    });
    vi.stubGlobal("fetch", transport);

    const profile = {
      provider: "openai",
      model: "gpt-vision-mock",
      apiKey: "inline-media-test-key",
      apiVariant: "responses"
    };
    const imageUrl = "data:image/svg+xml;base64,PHN2Zz48cmVjdCB3aWR0aD0iMSIgaGVpZ2h0PSIxIi8+PC9zdmc+";
    const input = buildProviderInput(profile, "review layout", [{
      type: "image",
      url: imageUrl,
      mimeType: "image/svg+xml",
      filename: "layout-default.svg",
      source: "geometry-only",
      redacted: true
    }]);
    const result = await Agrun.requestOpenAIChatCompletion(input);

    expect(transport).toHaveBeenCalledOnce();
    expect(providerRequests).toHaveLength(1);
    expect(providerRequests[0].url).toBe("https://api.openai.com/v1/responses");
    expect(providerRequests[0].body.input[0].content).toEqual(expect.arrayContaining([
      { type: "input_text", text: "review layout" },
      expect.objectContaining({ type: "input_image" })
    ]));
    const imagePart = providerRequests[0].body.input[0].content.find((part) => part.type === "input_image");
    expect(imagePart.image_url).toMatch(/^data:image\/[a-z0-9.+-]+;base64,/i);
    expect(result.text).toBe("layout reviewed");
    expect(JSON.stringify(result)).not.toContain(profile.apiKey);
  });
});
