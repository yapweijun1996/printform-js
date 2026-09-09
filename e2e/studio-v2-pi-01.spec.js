import { expect, test } from "@playwright/test";

function sse(events) {
  return `${events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")}data: [DONE]\n\n`;
}

function googleSse(events) {
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
}

function responsesSse(text = "pi responses reply") {
  return sse([
    { type: "response.created", response: { id: "pi01-response", created_at: 1770000000, model: "gpt-pi01" } },
    { type: "response.output_item.added", output_index: 0, item: { type: "message", id: "pi01-message", phase: "final_answer" } },
    { type: "response.output_text.delta", item_id: "pi01-message", delta: text },
    { type: "response.output_item.done", output_index: 0, item: { type: "message", id: "pi01-message", phase: "final_answer", content: [{ type: "output_text", text }] } },
    { type: "response.completed", response: { status: "completed", usage: { input_tokens: 4, output_tokens: 3, total_tokens: 7 } } }
  ]);
}

function chatSse(text = "pi chat reply") {
  return sse([
    { id: "pi01-chat", object: "chat.completion.chunk", created: 1770000000, model: "gpt-pi01", choices: [{ index: 0, delta: { role: "assistant", content: text }, finish_reason: null }] },
    { id: "pi01-chat", object: "chat.completion.chunk", created: 1770000000, model: "gpt-pi01", choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 4, completion_tokens: 3, total_tokens: 7 } }
  ]);
}

async function openQualification(page) {
  await page.goto("/studio-v2/pi-01/");
  return page.evaluate(() => ({
    id: globalThis.__PI_01_QUALIFICATION__.id,
    status: globalThis.__PI_01_QUALIFICATION__.status,
    browser: globalThis.__PI_01_QUALIFICATION__.browser
  }));
}

test.describe("Studio v2 PI-01 direct browser BYOK", () => {
  test("14-01 uses the actual pi-ai OpenAI Responses adapter from a static bundle", async ({ page, request }) => {
    let seen;
    await page.route("https://api.openai.com/v1/responses", async (route) => {
      seen = { body: route.request().postDataJSON(), headers: await route.request().allHeaders() };
      await route.fulfill({ status: 200, contentType: "text/event-stream", body: responsesSse() });
    });
    const runtime = await openQualification(page);
    const result = await page.evaluate(async () => {
      const qualification = globalThis.__PI_01_QUALIFICATION__;
      const adapter = qualification.createAdapter({ provider: "openai", model: "gpt-pi01", apiVariant: "responses", endpoint: "https://api.openai.com/v1", reasoningEffort: "medium" }, { apiKey: "PI01-RESPONSES-SYNTHETIC-KEY" });
      const response = await adapter.complete("direct Responses request");
      const serialized = JSON.stringify({ model: adapter.model, response });
      adapter.dispose();
      return { response, model: adapter.model, serialized };
    });
    expect(runtime).toMatchObject({ id: "PI-01", status: "ready", browser: { nodeGlobalsAbsent: true } });
    expect(result.response).toMatchObject({ stopReason: "stop", usage: { totalTokens: 7 } });
    expect(result.response.content).toEqual([expect.objectContaining({ type: "text", text: "pi responses reply" })]);
    expect(result.model).not.toHaveProperty("apiKey");
    expect(result.serialized).not.toContain("PI01-RESPONSES-SYNTHETIC-KEY");
    expect(seen.headers.authorization).toContain("PI01-RESPONSES-SYNTHETIC-KEY");
    expect(JSON.stringify(seen.body)).not.toContain("PI01-RESPONSES-SYNTHETIC-KEY");

    const bundle = await (await request.get("/studio-v2/pi-01/qualification-entry.js")).text();
    const manifest = await (await request.get("/studio-v2/pi-01/qualification-manifest.json")).json();
    expect(bundle).not.toMatch(/from\s*["']@earendil-works\/pi-/);
    expect(bundle).not.toMatch(/from\s*["']node:/);
    expect(bundle).not.toMatch(/\beval\s*\(/);
    expect(bundle).not.toContain("new Function");
    expect(manifest).toMatchObject({ id: "PI-01", static: true, appBackend: false, providerProxy: false, directBrowserByok: true });
    expect(manifest.bytes).toBe(Buffer.byteLength(bundle));
  });

  test("14-02 sends OpenAI Chat Completions to a configured compatible HTTPS endpoint", async ({ page }) => {
    let seen;
    await page.route("https://provider.test/v1/chat/completions", async (route) => {
      seen = { body: route.request().postDataJSON(), headers: await route.request().allHeaders() };
      await route.fulfill({ status: 200, contentType: "text/event-stream", body: chatSse() });
    });
    await openQualification(page);
    const result = await page.evaluate(async () => {
      const adapter = globalThis.__PI_01_QUALIFICATION__.createAdapter({ provider: "custom", model: "custom-pi01", apiVariant: "chat", endpoint: "https://provider.test/v1" }, { apiKey: "PI01-CHAT-SYNTHETIC-KEY" });
      const response = await adapter.complete("direct Chat request");
      adapter.dispose();
      return response;
    });
    expect(result).toMatchObject({ stopReason: "stop", usage: { totalTokens: 7 } });
    expect(result.content).toEqual([{ type: "text", text: "pi chat reply" }]);
    expect(seen.headers.authorization).toContain("PI01-CHAT-SYNTHETIC-KEY");
    expect(JSON.stringify(seen.body)).not.toContain("PI01-CHAT-SYNTHETIC-KEY");
    expect(seen.body).toMatchObject({ model: "custom-pi01", stream: true });
  });

  test("14-03 sends Gemini generateContent directly with the supplied key", async ({ page }) => {
    let seen;
    await page.route(/https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-pi01:streamGenerateContent\?alt=sse/, async (route) => {
      seen = { body: route.request().postDataJSON(), headers: await route.request().allHeaders() };
      await route.fulfill({ status: 200, contentType: "text/event-stream", body: googleSse([{ candidates: [{ content: { role: "model", parts: [{ text: "pi Gemini reply" }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 3, totalTokenCount: 7 } }]) });
    });
    await openQualification(page);
    const result = await page.evaluate(async () => {
      const adapter = globalThis.__PI_01_QUALIFICATION__.createAdapter({ provider: "gemini", model: "gemini-pi01" }, { apiKey: "PI01-GEMINI-SYNTHETIC-KEY" });
      const response = await adapter.complete("direct Gemini request");
      adapter.dispose();
      return response;
    });
    expect(result).toMatchObject({ stopReason: "stop", usage: { totalTokens: 7 } });
    expect(result.content).toEqual([{ type: "text", text: "pi Gemini reply" }]);
    expect(seen.headers["x-goog-api-key"]).toContain("PI01-GEMINI-SYNTHETIC-KEY");
    expect(JSON.stringify(seen.body)).not.toContain("PI01-GEMINI-SYNTHETIC-KEY");
    expect(seen.body).toMatchObject({ contents: [{ role: "user", parts: [{ text: "direct Gemini request" }] }] });
  });

  test("14-04 rejects missing and locked-vault credentials before any provider request", async ({ page }) => {
    const providerRequests = [];
    await page.route(/https:\/\/(?:api\.openai\.com|provider\.test)\//, async (route) => {
      providerRequests.push(route.request().url());
      await route.abort();
    });
    await openQualification(page);
    const result = await page.evaluate(async () => {
      const qualification = globalThis.__PI_01_QUALIFICATION__;
      const profile = { id: "pi01-locked", provider: "custom", model: "custom-pi01", apiVariant: "chat", endpoint: "https://provider.test/v1" };
      const missing = qualification.createAdapter(profile, { apiKey: "" });
      let missingCode;
      try { await missing.complete("must not send"); } catch (error) { missingCode = error.code; }
      missing.dispose();

      const { ByokVault } = await import("/studio-v2/ui/agent-vault.js");
      const vault = new ByokVault({ dbName: `pi01-${crypto.randomUUID()}` });
      await vault.unlock("pi01 synthetic passphrase");
      await vault.saveProfile({ ...profile, apiKey: "PI01-LOCKED-SYNTHETIC-KEY" });
      vault.lock();
      const locked = qualification.createAdapter(profile, { getApiKey: () => vault.getProfile(profile.id)?.apiKey || "" });
      let lockedCode;
      try { await locked.complete("locked must not send"); } catch (error) { lockedCode = error.code; }
      locked.dispose();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await vault.clear();
      return { missingCode, lockedCode };
    });
    expect(result).toEqual({ missingCode: "BYOK_REQUIRED", lockedCode: "BYOK_REQUIRED" });
    expect(providerRequests).toEqual([]);
  });

  test("14-05 projects only validated synthetic image evidence into the provider body", async ({ page }) => {
    let seen;
    await page.route("https://api.openai.com/v1/responses", async (route) => {
      seen = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: "text/event-stream", body: responsesSse("pi image reply") });
    });
    await openQualification(page);
    const result = await page.evaluate(async () => {
      const adapter = globalThis.__PI_01_QUALIFICATION__.createAdapter({ provider: "openai", model: "gpt-vision-pi01", apiVariant: "responses", endpoint: "https://api.openai.com/v1" }, { apiKey: "PI01-IMAGE-SYNTHETIC-KEY" });
      const response = await adapter.complete("review the redacted layout", [{ type: "image", url: "data:image/png;base64,AAAA", mimeType: "image/png", filename: "layout.png", source: "sandbox-pixel", syntheticData: true, redacted: false }], { dataPolicy: { allowPixelEvidence: true } });
      adapter.dispose();
      return { response, serialized: JSON.stringify(response) };
    });
    const parts = seen.input[0].content;
    expect(result.response.content).toEqual([expect.objectContaining({ type: "text", text: "pi image reply" })]);
    expect(parts).toEqual(expect.arrayContaining([{ type: "input_text", text: "review the redacted layout" }, expect.objectContaining({ type: "input_image", image_url: "data:image/png;base64,AAAA" })]));
    expect(JSON.stringify(seen)).not.toContain("PI01-IMAGE-SYNTHETIC-KEY");
    expect(JSON.stringify(seen)).not.toContain("sandbox-pixel");
    expect(result.serialized).not.toContain("PI01-IMAGE-SYNTHETIC-KEY");
  });

  test("14-06 exposes provider failure, aborts the request and releases the adapter key", async ({ page }) => {
    let calls = 0;
    await page.route("https://provider.test/v1/chat/completions", async (route) => {
      calls += 1;
      if (calls === 1) {
        await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: { message: "synthetic provider failure" } }) });
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
      try { await route.fulfill({ status: 200, contentType: "text/event-stream", body: chatSse("late reply") }); } catch { /* Browser abort owns this route. */ }
    });
    await openQualification(page);
    const result = await page.evaluate(async () => {
      const adapter = globalThis.__PI_01_QUALIFICATION__.createAdapter({ provider: "custom", model: "custom-pi01", apiVariant: "chat", endpoint: "https://provider.test/v1" }, { apiKey: "PI01-LIFECYCLE-SYNTHETIC-KEY" });
      const failed = await adapter.complete("provider failure");
      const controller = new AbortController();
      const stream = await adapter.stream("abort this request", [], { signal: controller.signal });
      const pending = stream.result();
      await new Promise((resolve) => setTimeout(resolve, 50));
      controller.abort();
      const aborted = await pending;
      adapter.dispose();
      let disposedCode;
      try { await adapter.complete("disposed must not send"); } catch (error) { disposedCode = error.code; }
      return { failed, aborted, disposedCode, failedText: JSON.stringify(failed), abortedText: JSON.stringify(aborted) };
    });
    expect(calls).toBe(2);
    expect(result.failed.stopReason).toBe("error");
    expect(result.aborted.stopReason).toBe("aborted");
    expect(result.disposedCode).toBe("BYOK_ADAPTER_DISPOSED");
    expect(result.failedText).not.toContain("PI01-LIFECYCLE-SYNTHETIC-KEY");
    expect(result.abortedText).not.toContain("PI01-LIFECYCLE-SYNTHETIC-KEY");
  });
});
