import { expect, test } from "@playwright/test";

function directChatToolSse() {
  const argumentsJson = JSON.stringify({ expectedRevision: 0, operations: [{
    type: "set_column_widths", tableSelector: ".scope-table-a-header, .scope-table-a-row",
    widths: ["12%", "43%", "11%", "16%", "18%"]
  }] });
  const events = [
    { id: "pi04-direct-1", object: "chat.completion.chunk", created: 1770000000, model: "pi04-chat", choices: [{ index: 0, delta: { role: "assistant", tool_calls: [{ index: 0, id: "pi04-call-preview", type: "function", function: { name: "printform_preview_changes", arguments: argumentsJson } }] }, finish_reason: null }] },
    { id: "pi04-direct-1", object: "chat.completion.chunk", created: 1770000000, model: "pi04-chat", choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] }
  ];
  return `${events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")}data: [DONE]\n\n`;
}

function directResponsesToolSse() {
  const argumentsJson = JSON.stringify({ expectedRevision: 0, operations: [{
    type: "set_column_widths", tableSelector: ".scope-table-a-header, .scope-table-a-row",
    widths: ["12%", "43%", "11%", "16%", "18%"]
  }] });
  const functionCall = { type: "function_call", id: "fc_pi04_direct", call_id: "call_pi04_direct",
    name: "printform_preview_changes", arguments: argumentsJson };
  const events = [
    { type: "response.created", response: { id: "pi04-response", created_at: 1770000000, model: "pi04-responses" } },
    { type: "response.output_item.added", output_index: 0, item: { ...functionCall, arguments: "" } },
    { type: "response.function_call_arguments.done", output_index: 0, arguments: argumentsJson },
    { type: "response.output_item.done", output_index: 0, item: functionCall },
    { type: "response.completed", response: { id: "pi04-response", status: "completed", usage: { input_tokens: 4, output_tokens: 3, total_tokens: 7 } } }
  ];
  return `${events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")}data: [DONE]\n\n`;
}

function directGeminiToolSse() {
  const event = { candidates: [{ content: { role: "model", parts: [{ functionCall: {
    name: "printform_preview_changes", args: { expectedRevision: 0, operations: [{
      type: "set_column_widths", tableSelector: ".scope-table-a-header, .scope-table-a-row",
      widths: ["12%", "43%", "11%", "16%", "18%"]
    }] }
  } }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 3, totalTokenCount: 7 } };
  return `data: ${JSON.stringify(event)}\n\n`;
}

function directFollowUpSse(requestNumber) {
  const previewArgs = JSON.stringify({ expectedRevision: 0, operations: [{
    type: "set_column_widths", tableSelector: ".scope-table-a-header, .scope-table-a-row",
    widths: ["12%", "43%", "11%", "16%", "18%"]
  }] });
  const call = requestNumber === 1
    ? { id: "pi04-follow-summary", type: "function", function: { name: "printform_get_project_summary", arguments: "{}" } }
    : { id: "pi04-follow-preview", type: "function", function: { name: "printform_preview_changes", arguments: previewArgs } };
  const event = { id: `pi04-follow-${requestNumber}`, object: "chat.completion.chunk", created: 1770000000, model: "pi04-follow-up",
    choices: [{ index: 0, delta: { role: "assistant", tool_calls: [{ index: 0, ...call }] }, finish_reason: "tool_calls" }] };
  return `data: ${JSON.stringify(event)}\n\ndata: [DONE]\n\n`;
}

async function openQualification(page) {
  const externalRequests = [];
  page.on("request", (request) => {
    if (/^https?:/u.test(request.url()) && !request.url().startsWith("http://127.0.0.1")) externalRequests.push(request.url());
  });
  await page.goto("/studio-v2/pi-04/");
  const runtime = await page.evaluate(() => {
    const qualification = globalThis.__PI_04_QUALIFICATION__;
    return { id: qualification.id, status: qualification.status, browser: qualification.browser,
      actualHarness: qualification.actualHarness, policyBound: qualification.policyBound, frontendOnly: qualification.frontendOnly, pin: qualification.pin };
  });
  return { runtime, externalRequests };
}

test.describe("Studio v2 PI-04 composed acceptance", () => {
  test("17-01 completes X-01 through actual PI, policy session, approval, review and human export", async ({ page, request }) => {
    const opened = await openQualification(page);
    const result = await page.evaluate(async () => globalThis.__PI_04_QUALIFICATION__.runCase("17-01"));
    expect(opened.runtime).toMatchObject({ id: "PI-04", status: "ready", actualHarness: true, policyBound: true, frontendOnly: true, browser: { nodeGlobalsAbsent: true } });
    expect(result).toMatchObject({ caseId: "17-01", status: "passed", result: {
      mode: "preview", policy: "unknown", scope: { kind: "table", tableId: "a" }, sessionMode: "memory", candidateRenderCount: expect.any(Number),
      providerCalls: 2, providerSawCanary: false, noCanaryInQualificationOutput: true,
      noUnauthorizedCanaryPersistence: true, noUnauthorizedCanaryExposure: true,
      revision: 1, revisionEntries: [0, 1], readiness: "ready", export: {
        ok: true, mode: "saved", evidenceRevision: 1, embeddedRevision: 1, confirmCalls: 2,
        saveStates: ["saving", "saved"]
      }
    } });
    expect(result.result.candidateRenderCount).toBeGreaterThan(0);
    expect(result.result.firstRun.ok).toBe(true);
    expect(result.result.applied).toMatchObject({ ok: true, revision: 1 });
    expect(result.result.render).toMatchObject({ status: "ready", revision: 1, visualMode: "geometry", overflowElements: 0 });
    expect(result.result.render.logicalPages).toBeGreaterThan(0);
    expect(result.result.review).toMatchObject({ attempt: 1, evidenceCount: 2, run: { ok: true } });
    expect(result.result.calls).toEqual(expect.arrayContaining([
      { surface: "agent", name: "preview_changes" },
      { surface: "human", name: "approve_transaction" },
      { surface: "human", name: "apply_changes" },
      { surface: "agent", name: "begin_layout_review" },
      { surface: "agent", name: "capture_layout_evidence" },
      { surface: "agent", name: "complete_layout_review" }
    ]));
    expect(opened.externalRequests).toEqual([]);
    const bundle = await (await request.get("/studio-v2/pi-04/qualification-entry.js")).text();
    const manifest = await (await request.get("/studio-v2/pi-04/qualification-manifest.json")).json();
    expect(bundle).not.toMatch(/from\s*["']@earendil-works\/pi-/u);
    expect(bundle).not.toMatch(/from\s*["']node:/u);
    expect(bundle).not.toMatch(/\beval\s*\(/u);
    expect(bundle).not.toContain("new Function");
    expect(manifest).toMatchObject({ id: "PI-04", static: true, frontendOnly: true, appBackend: false, providerProxy: false, actualHarness: true, policyBound: true, privateHumanApproval: true, canonicalCommandBus: true, x01: true, x02: true, x03: true, directProviderChat: true, directProviderResponses: true, directProviderGemini: true, directProviderFollowUp: true, directProviderCommitRecovery: true, directProviderRealPrivacy: true, providerMatrixSynthetic: true, liveByokSmoke: false });
    expect(manifest.bytes).toBe(Buffer.byteLength(bundle));
  });

  test("17-02 rejects an old candidate after policy, mode and scope interleave", async ({ page }) => {
    const opened = await openQualification(page);
    const result = await page.evaluate(async () => globalThis.__PI_04_QUALIFICATION__.runCase("17-02"));
    expect(opened.runtime).toMatchObject({ id: "PI-04", status: "ready", actualHarness: true, policyBound: true, frontendOnly: true });
    expect(result).toMatchObject({ caseId: "17-02", status: "passed", result: {
      policy: "real", applyMode: "preview", scope: { kind: "component", componentId: "table-a-header" },
      sessionMode: "memory", run: { ok: false }, revision: 0, committedContentAvailable: true,
      noStaleCommit: true, readiness: { productionValid: false }, noMisleadingStatus: true,
      providerSawCanary: false, noCanaryInQualificationOutput: true
    } });
    expect(result.result.run.error.code).toBe("HARNESS_HANDLER_ERROR");
    expect(result.result.readiness.codes).toEqual(expect.arrayContaining(["PREVIEW_REQUIRED", "LAYOUT_REVIEW_REQUIRED"]));
    expect(opened.externalRequests).toEqual([]);
  });

  test("17-03 isolates document B from a delayed review callback from document A", async ({ page }) => {
    const opened = await openQualification(page);
    const result = await page.evaluate(async () => globalThis.__PI_04_QUALIFICATION__.runCase("17-03"));
    expect(opened.runtime).toMatchObject({ id: "PI-04", status: "ready", actualHarness: true, policyBound: true, frontendOnly: true });
    expect(result).toMatchObject({ caseId: "17-03", status: "passed", result: {
      activeDocument: "b", oldRun: { ok: false, error: { code: "HARNESS_HANDLER_ERROR" } },
      oldRunError: "HARNESS_HANDLER_ERROR", firstRevision: 0, firstProjectStable: true,
      second: { documentId: "pi04-x03-document-b", classification: "unknown", scope: { kind: "table", tableId: "a" },
        applyMode: "preview", revision: 0, projectStable: true, evidencePackPresent: false,
        chatEntryCount: 0, readinessProductionValid: false
      }, noCanaryInQualificationOutput: true
    } });
    expect(result.result.second.readinessCodes).toEqual(expect.arrayContaining(["PREVIEW_REQUIRED", "LAYOUT_REVIEW_REQUIRED"]));
    expect(opened.externalRequests).toEqual([]);
  });

  test("17-04 composes the actual PI Harness with direct browser Chat Completions", async ({ page }) => {
    const requests = [];
    await page.route("https://provider.test/v1/chat/completions", async (route) => {
      if (route.request().method() !== "POST") {
        await route.fulfill({ status: 204, headers: {
          "access-control-allow-origin": "*", "access-control-allow-headers": "authorization,content-type"
        } });
        return;
      }
      requests.push({ body: route.request().postDataJSON(), headers: await route.request().allHeaders() });
      await route.fulfill({ status: 200, contentType: "text/event-stream", headers: { "access-control-allow-origin": "*" }, body: directChatToolSse() });
    });
    const opened = await openQualification(page);
    const result = await page.evaluate(async () => globalThis.__PI_04_QUALIFICATION__.runCase("17-04"));
    expect(opened.runtime).toMatchObject({ id: "PI-04", status: "ready", actualHarness: true, policyBound: true, frontendOnly: true });
    expect(result).toMatchObject({ caseId: "17-04", status: "passed", result: {
      provider: "openai-compatible-chat", run: { ok: true }, proposalCount: 1,
      revision: 0, sessionMode: "memory", candidateRenderCount: 1, noCanaryInQualificationOutput: true,
      noProviderCredentialInQualificationOutput: true
    } });
    expect(result.result.calls).toEqual([{ surface: "agent", name: "preview_changes" }]);
    expect(requests).toHaveLength(1);
    expect(requests[0].headers.authorization).toContain("PI04-DIRECT-SYNTHETIC-KEY");
    const body = JSON.stringify(requests[0].body);
    expect(requests[0].body).toMatchObject({ model: "pi04-chat", stream: true });
    expect(body).not.toContain("PI04-DIRECT-SYNTHETIC-KEY");
    expect(body).not.toContain("PI04-PRIVATE-CANARY-20260909");
    expect(opened.externalRequests.every((url) => url === "https://provider.test/v1/chat/completions")).toBe(true);
  });

  test("17-05 composes the actual PI Harness with direct browser OpenAI Responses", async ({ page }) => {
    const requests = [];
    await page.route("https://api.openai.com/v1/responses", async (route) => {
      if (route.request().method() !== "POST") {
        await route.fulfill({ status: 204, headers: {
          "access-control-allow-origin": "*", "access-control-allow-headers": "authorization,content-type"
        } });
        return;
      }
      requests.push({ body: route.request().postDataJSON(), headers: await route.request().allHeaders() });
      await route.fulfill({ status: 200, contentType: "text/event-stream", headers: { "access-control-allow-origin": "*" }, body: directResponsesToolSse() });
    });
    const opened = await openQualification(page);
    const result = await page.evaluate(async () => globalThis.__PI_04_QUALIFICATION__.runCase("17-05"));
    expect(opened.runtime).toMatchObject({ id: "PI-04", status: "ready", actualHarness: true, policyBound: true, frontendOnly: true });
    expect(result).toMatchObject({ caseId: "17-05", status: "passed", result: {
      provider: "openai-responses", run: { ok: true }, proposalCount: 1,
      revision: 0, sessionMode: "memory", candidateRenderCount: 1, noCanaryInQualificationOutput: true,
      noProviderCredentialInQualificationOutput: true
    } });
    expect(result.result.calls).toEqual([{ surface: "agent", name: "preview_changes" }]);
    expect(requests).toHaveLength(1);
    expect(requests[0].headers.authorization).toContain("PI04-RESPONSES-SYNTHETIC-KEY");
    const body = JSON.stringify(requests[0].body);
    expect(requests[0].body).toMatchObject({ model: "pi04-responses", stream: true });
    expect(body).toContain("printform_preview_changes");
    expect(body).not.toContain("PI04-RESPONSES-SYNTHETIC-KEY");
    expect(body).not.toContain("PI04-PRIVATE-CANARY-20260909");
    expect(opened.externalRequests.every((url) => url === "https://api.openai.com/v1/responses")).toBe(true);
  });

  test("17-06 composes the actual PI Harness with direct browser Gemini", async ({ page }) => {
    const requests = [];
    await page.route(/https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/pi04-gemini:streamGenerateContent\?alt=sse/u, async (route) => {
      if (route.request().method() !== "POST") {
        await route.fulfill({ status: 204, headers: {
          "access-control-allow-origin": "*", "access-control-allow-headers": "x-goog-api-key,content-type"
        } });
        return;
      }
      requests.push({ body: route.request().postDataJSON(), headers: await route.request().allHeaders() });
      await route.fulfill({ status: 200, contentType: "text/event-stream", headers: { "access-control-allow-origin": "*" }, body: directGeminiToolSse() });
    });
    const opened = await openQualification(page);
    const result = await page.evaluate(async () => globalThis.__PI_04_QUALIFICATION__.runCase("17-06"));
    expect(opened.runtime).toMatchObject({ id: "PI-04", status: "ready", actualHarness: true, policyBound: true, frontendOnly: true });
    expect(result).toMatchObject({ caseId: "17-06", status: "passed", result: {
      provider: "google-gemini", run: { ok: true }, proposalCount: 1,
      revision: 0, sessionMode: "memory", candidateRenderCount: 1, noCanaryInQualificationOutput: true,
      noProviderCredentialInQualificationOutput: true
    } });
    expect(result.result.calls).toEqual([{ surface: "agent", name: "preview_changes" }]);
    expect(requests).toHaveLength(1);
    expect(requests[0].headers["x-goog-api-key"]).toContain("PI04-GEMINI-SYNTHETIC-KEY");
    const body = JSON.stringify(requests[0].body);
    expect(body).toContain("printform_preview_changes");
    expect(body).not.toContain("PI04-GEMINI-SYNTHETIC-KEY");
    expect(body).not.toContain("PI04-PRIVATE-CANARY-20260909");
    expect(opened.externalRequests.every((url) => url.startsWith("https://generativelanguage.googleapis.com/v1beta/models/pi04-gemini:streamGenerateContent"))).toBe(true);
  });

  test("17-07 keeps a direct-provider follow-up payload safe across two Harness requests", async ({ page }) => {
    const requests = [];
    await page.route("https://provider.test/v1/chat/completions", async (route) => {
      if (route.request().method() !== "POST") {
        await route.fulfill({ status: 204, headers: {
          "access-control-allow-origin": "*", "access-control-allow-headers": "authorization,content-type"
        } });
        return;
      }
      requests.push({ body: route.request().postDataJSON(), headers: await route.request().allHeaders() });
      await route.fulfill({ status: 200, contentType: "text/event-stream", headers: { "access-control-allow-origin": "*" }, body: directFollowUpSse(requests.length) });
    });
    const opened = await openQualification(page);
    const result = await page.evaluate(async () => globalThis.__PI_04_QUALIFICATION__.runCase("17-07"));
    expect(opened.runtime).toMatchObject({ id: "PI-04", status: "ready", actualHarness: true, policyBound: true, frontendOnly: true });
    expect(result).toMatchObject({ caseId: "17-07", status: "passed", result: {
      provider: "openai-chat-follow-up", run: { ok: true }, proposalCount: 1,
      revision: 0, sessionMode: "memory", candidateRenderCount: 1, noCanaryInQualificationOutput: true,
      noProviderCredentialInQualificationOutput: true
    } });
    expect(result.result.calls).toEqual([
      { surface: "agent", name: "get_project_summary" },
      { surface: "agent", name: "preview_changes" }
    ]);
    expect(requests).toHaveLength(2);
    for (const request of requests) {
      expect(request.headers.authorization).toContain("PI04-FOLLOW-UP-SYNTHETIC-KEY");
      const body = JSON.stringify(request.body);
      expect(body).not.toContain("PI04-FOLLOW-UP-SYNTHETIC-KEY");
      expect(body).not.toContain("PI04-PRIVATE-CANARY-20260909");
    }
    expect(JSON.stringify(requests[1].body)).toContain("printform_get_project_summary");
    expect(opened.externalRequests.every((url) => url === "https://provider.test/v1/chat/completions")).toBe(true);
  });
});
