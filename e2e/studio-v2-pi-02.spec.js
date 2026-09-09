import { expect, test } from "@playwright/test";

async function openQualification(page) {
  const externalRequests = [];
  page.on("request", (request) => {
    if (/^https?:/u.test(request.url()) && !request.url().startsWith("http://127.0.0.1")) externalRequests.push(request.url());
  });
  await page.goto("/studio-v2/pi-02/");
  const runtime = await page.evaluate(() => {
    const qualification = globalThis.__PI_02_QUALIFICATION__;
    return { id: qualification.id, status: qualification.status, browser: qualification.browser, actualHarness: qualification.actualHarness, actualMemorySessionRepo: qualification.actualMemorySessionRepo, pin: qualification.pin };
  });
  return { runtime, externalRequests };
}

async function runCase(page, caseId) {
  return page.evaluate(async (id) => globalThis.__PI_02_QUALIFICATION__.runCase(id), caseId);
}

function types(result) { return result.result.events.map((event) => event.type); }
function names(result) { return result.result.calls.map((call) => call.name); }
function hasForbiddenCommand(calls) { return calls.some((call) => ["approve_transaction", "apply_changes"].includes(call.name)); }

test.describe("Studio v2 PI-02 actual Harness host tools and events", () => {
  test("15-01 maps a terminal preview tool through the existing gateway and keeps a proposal", async ({ page, request }) => {
    const opened = await openQualification(page);
    const result = await runCase(page, "15-01");
    expect(opened.runtime).toMatchObject({ id: "PI-02", status: "ready", actualHarness: true, actualMemorySessionRepo: true, browser: { nodeGlobalsAbsent: true } });
    expect(result).toMatchObject({ caseId: "15-01", status: "passed", result: { run: { ok: true }, providerCalls: 1 } });
    expect(result.result.proposals).toHaveLength(1);
    expect(result.result.calls).toEqual([{ surface: "agent", name: "preview_changes" }]);
    expect(types(result)).toEqual(expect.arrayContaining(["tool_start", "tool_result", "proposal_ready", "terminal_state", "completed"]));
    expect(hasForbiddenCommand(result.result.calls)).toBe(false);
    expect(result.result.tools).not.toEqual(expect.arrayContaining(["printform_approve_transaction", "printform_apply_changes"]));
    expect(opened.externalRequests).toEqual([]);
    const bundle = await (await request.get("/studio-v2/pi-02/qualification-entry.js")).text();
    const manifest = await (await request.get("/studio-v2/pi-02/qualification-manifest.json")).json();
    expect(bundle).not.toMatch(/from\s*["']@earendil-works\/pi-/u);
    expect(bundle).not.toMatch(/from\s*["']node:/u);
    expect(bundle).not.toMatch(/\beval\s*\(/u);
    expect(bundle).not.toContain("new Function");
    expect(manifest).toMatchObject({ id: "PI-02", static: true, appBackend: false, providerProxy: false, actualHarness: true, memorySession: true, toolExecution: "sequential" });
    expect(manifest.bytes).toBe(Buffer.byteLength(bundle));
  });

  test("15-02 completes layout review from two Studio-issued geometry receipts", async ({ page }) => {
    const opened = await openQualification(page);
    const result = await runCase(page, "15-02");
    expect(opened.externalRequests).toEqual([]);
    expect(result).toMatchObject({ caseId: "15-02", status: "passed", result: { run: { ok: true }, providerCalls: 1, reviewStatus: "pass", reviewSetup: { attempt: 1, scenarios: ["default", "long-text"] } } });
    expect(result.result.calls.map((call) => call.name)).toEqual(["begin_layout_review", "capture_layout_evidence", "capture_layout_evidence", "complete_layout_review"]);
    expect(result.result.proposals).toEqual([]);
    expect(types(result)).toEqual(expect.arrayContaining(["tool_start", "tool_result", "terminal_state", "completed"]));
  });

  test("15-03 makes terminal-first plus same-batch tool calls fail closed", async ({ page }) => {
    const opened = await openQualification(page);
    const result = await runCase(page, "15-03");
    expect(opened.externalRequests).toEqual([]);
    expect(result).toMatchObject({ caseId: "15-03", status: "passed", result: { providerCalls: 1, state: { blockedAfterTerminal: true } } });
    expect(result.result.calls).toEqual([{ surface: "agent", name: "preview_changes" }]);
    expect(result.result.proposals).toHaveLength(1);
    expect(result.result.events.filter((event) => event.type === "tool_result")).toHaveLength(2);
    expect(hasForbiddenCommand(result.result.calls)).toBe(false);
  });

  test("15-04 surfaces malformed input, gateway failure and missing-terminal recovery safely", async ({ page }) => {
    const opened = await openQualification(page);
    const result = await runCase(page, "15-04");
    expect(opened.externalRequests).toEqual([]);
    expect(result).toMatchObject({ caseId: "15-04", status: "passed" });
    expect(result.result.malformed.calls).not.toEqual(expect.arrayContaining([expect.objectContaining({ name: "preview_changes" })]));
    expect(result.result.malformed.run.error.code).toBe("TERMINAL_ACTION_REQUIRED");
    expect(result.result.commandError.run.error.code).toBe("SCOPE_VIOLATION");
    expect(result.result.commandError.calls).toEqual([{ surface: "agent", name: "preview_changes" }]);
    expect(result.result.missingTerminal.run.error.code).toBe("TERMINAL_ACTION_REQUIRED");
    expect(result.result.missingTerminal.proposals).toEqual([]);
  });

  test("15-05 enforces action, repeated-action and token budgets inside the host hook", async ({ page }) => {
    const opened = await openQualification(page);
    const result = await runCase(page, "15-05");
    expect(opened.externalRequests).toEqual([]);
    expect(result).toMatchObject({ caseId: "15-05", status: "passed" });
    expect(result.result.action.run.error.code).toBe("TURN_ACTION_LIMIT");
    expect(result.result.repeat.run.error.code).toBe("REPEATED_ACTION");
    expect(result.result.token.run.error.code).toBe("TURN_TOKEN_LIMIT");
    expect(result.result.action.providerCalls).toBeLessThanOrEqual(9);
    expect(result.result.repeat.providerCalls).toBeLessThanOrEqual(2);
    expect(result.result.token.providerCalls).toBeLessThanOrEqual(2);
    expect(result.result.action.events).toEqual(expect.arrayContaining([expect.objectContaining({ type: "budget_warning", detail: { code: "TURN_ACTION_LIMIT" } })]));
  });

  test("15-06 requires private human approval, reconciles a lost apply response and rejects stale candidates", async ({ page }) => {
    const opened = await openQualification(page);
    const result = await runCase(page, "15-06");
    expect(opened.externalRequests).toEqual([]);
    expect(result).toMatchObject({ caseId: "15-06", status: "passed", result: { lostResponse: { applied: { ok: true, revision: 1, alreadyCommitted: true }, revision: 1 }, staleCandidate: { changed: true, revision: 1, error: { code: "REVISION_CONFLICT" } } } });
    expect(result.result.lostResponse.calls).toEqual(expect.arrayContaining([
      { surface: "agent", name: "preview_changes" }, { surface: "human", name: "approve_transaction" },
      { surface: "human", name: "apply_changes" }, { surface: "private", name: "get_transaction" }, { surface: "private", name: "validate_project" }
    ]));
    expect(result.result.lostResponse.calls.filter((call) => call.surface === "agent")).not.toEqual(expect.arrayContaining([expect.objectContaining({ name: "approve_transaction" }), expect.objectContaining({ name: "apply_changes" })]));
    expect(result.result.staleCandidate.calls).not.toEqual(expect.arrayContaining([expect.objectContaining({ surface: "human", name: "apply_changes" })]));
  });
});
