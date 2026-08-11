import { describe, expect, it } from "vitest";
import { buildAuditRows, createAgentTrace, formatTraceRecord, sanitizeTraceEvent } from "../../studio-v2/ui/agent-trace.js";
import { runtimeFailed } from "../../studio-v2/ui/agent-panel-runtime.js";
import { translateAgentError } from "../../studio-v2/ui/agent-error-text.js";
import { DesignerRuntimeController } from "../../studio-v2/ui/agent-runtime.js";

describe("AI Designer runtime trace", () => {
  it("keeps only allowlisted operational metadata", () => {
    let time = 1000;
    const trace = createAgentTrace({ now: () => time, limit: 20 });
    trace.observe({ type: "runtime_config", detail: { provider: "openai", model: "gpt-5.4-mini", maxSteps: 100, apiKey: "secret-key" } });
    time += 25;
    trace.observe({ type: "turn_start", detail: { prompt: "SECRET ERP CUSTOMER" } });
    time += 25;
    trace.observe({
      type: "tool_start",
      detail: {
        actionName: "printform_inspect_design_state",
        args: { customer: "SECRET ERP CUSTOMER", amount: 91234.56 },
        providerRequest: { authorization: "Bearer secret-key" }
      }
    });
    time += 25;
    trace.observe({
      type: "tool_result",
      detail: { actionName: "printform_inspect_design_state", ok: true, result: { renderedText: "SECRET ERP CUSTOMER", total: 91234.56 } }
    });

    const serialized = JSON.stringify(trace.getSnapshot());
    expect(serialized).toContain("printform_inspect_design_state");
    expect(serialized).toContain("gpt-5.4-mini");
    expect(serialized).not.toContain("SECRET ERP CUSTOMER");
    expect(serialized).not.toContain("secret-key");
    expect(serialized).not.toContain("91234.56");
    expect(trace.getSnapshot().at(-1)).toMatchObject({ type: "tool_result", action: "printform_inspect_design_state", status: "ok", step: 1 });
  });

  it("records terminal codes but never raw error messages", () => {
    const record = sanitizeTraceEvent({
      type: "completed",
      detail: {
        terminalKind: "error",
        result: { error: { code: "MAX_STEPS_EXCEEDED", message: "Action loop leaked SECRET VALUE" } }
      }
    }, { sequence: 1, elapsedMs: 12, turn: 1, step: 12 });

    expect(record).toMatchObject({ type: "completed", terminalKind: "error", code: "MAX_STEPS_EXCEEDED", step: 12 });
    expect(JSON.stringify(record)).not.toContain("SECRET VALUE");
  });

  it("makes terminal convergence attempts visible without exposing proposal data", () => {
    const record = sanitizeTraceEvent({
      type: "terminal_action_required",
      detail: { state: "blocked", status: "blocked", attempt: 3, maxAttempts: 3, source: "planner_final", proposalId: "secret-proposal" }
    }, { sequence: 2, elapsedMs: 40, turn: 1, step: 3 });
    expect(record).toMatchObject({ type: "terminal_action_required", attempt: 3, maxAttempts: 3, status: "blocked" });
    expect(JSON.stringify(record)).not.toContain("secret-proposal");

    const terminal = sanitizeTraceEvent({
      type: "terminal_state", detail: { state: "proposal_ready", actionName: "printform_preview_changes" }
    }, { sequence: 3, elapsedMs: 45, turn: 1, step: 3 });
    expect(terminal).toMatchObject({ type: "terminal_state", terminalState: "proposal_ready", action: "printform_preview_changes" });
  });

  it("makes planner phases and safe action names visible", () => {
    const record = sanitizeTraceEvent({
      type: "phase",
      phase: "act",
      detail: { transition: "completed", info: { actionName: "printform_preview_changes", outcome: "executed" } }
    }, { sequence: 4, elapsedMs: 12, turn: 1, step: 3 });
    expect(record).toMatchObject({ type: "phase", phase: "act", transition: "completed", action: "printform_preview_changes", outcome: "executed" });
  });

  it("shows AGRUN action-result normalization without exposing action payloads", () => {
    const record = sanitizeTraceEvent({
      type: "action-executed",
      detail: {
        actionName: "printform_preview_changes", control: "complete", status: "success",
        kind: "printform_result", resultEnvelopeVersion: "v1", planIndex: 0,
        runtimeBuildId: "ee53fdabf-dirty", agrunCommit: "c631669ac927ff734a37eeef863941f040445182",
        body: { renderedText: "SECRET ERP CUSTOMER", amount: 91234.56 }
      }
    }, { sequence: 5, elapsedMs: 20, turn: 1, step: 4 });

    expect(record).toMatchObject({
      type: "action-executed", action: "printform_preview_changes", control: "complete",
      resultKind: "printform_result", resultEnvelopeVersion: "v1", planIndex: 0,
      runtimeBuildId: "ee53fdabf-dirty", agrunCommit: "c631669ac927ff734a37eeef863941f040445182"
    });
    expect(JSON.stringify(record)).not.toContain("SECRET ERP CUSTOMER");
    expect(JSON.stringify(record)).not.toContain("91234.56");

    const protocolError = sanitizeTraceEvent({
      type: "action-executed",
      detail: {
        actionName: "printform_preview_changes", control: "continue", status: "protocol_error",
        kind: "action_envelope_protocol_error", resultEnvelopeVersion: "v1"
      }
    }, { sequence: 6, elapsedMs: 25, turn: 1, step: 4 });
    expect(protocolError).toMatchObject({ control: "continue", status: "protocol_error", resultKind: "action_envelope_protocol_error" });
  });

  it("turns planner noise into readable action audit rows and marks repeats", () => {
    const rows = buildAuditRows([
      { sequence: 1, elapsedMs: 0, turn: 1, step: 1, type: "phase", phase: "observe", transition: "completed" },
      { sequence: 2, elapsedMs: 10, turn: 1, step: 1, type: "phase", phase: "decide", transition: "completed", action: "printform_preview_changes", outcome: "selected" },
      { sequence: 3, elapsedMs: 10, turn: 1, step: 2, type: "phase", phase: "orient", transition: "completed" },
      { sequence: 4, elapsedMs: 20, turn: 1, step: 2, type: "phase", phase: "act", transition: "completed", action: "printform_preview_changes", outcome: "executed" },
      { sequence: 5, elapsedMs: 30, turn: 1, step: 2, type: "phase", phase: "decide", transition: "completed", action: "printform_preview_changes", outcome: "selected" },
      { sequence: 6, elapsedMs: 40, turn: 1, step: 3, type: "phase", phase: "act", transition: "completed", action: "printform_preview_changes", outcome: "executed" }
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ kind: "action", selected: true, executed: true, occurrence: 1 });
    expect(rows[1]).toMatchObject({ kind: "action", selected: true, executed: true, occurrence: 2 });
    expect(formatTraceRecord(rows[0])).toContain("Preview Changes [printform_preview_changes]");
    expect(formatTraceRecord(rows[0])).toContain("selected → executed");
    expect(formatTraceRecord(rows[1])).toContain("repeat #2");
    expect(formatTraceRecord(rows[0])).not.toContain("SECRET");
  });

  it("shows turn and session token totals without retaining provider payloads", () => {
    const record = sanitizeTraceEvent({ type: "usage", usage: { totalTokens: 75, sessionTotalTokens: 433512, secret: "ERP" } }, { sequence: 5, elapsedMs: 12, turn: 1, step: 3 });
    expect(record).toMatchObject({ type: "usage", totalTokens: 75, sessionTotalTokens: 433512 });
    expect(JSON.stringify(record)).not.toContain("ERP");
  });

  it("explains which safety budget stopped the turn", () => {
    const record = sanitizeTraceEvent({
      type: "circuit_breaker_tripped",
      detail: { code: "TURN_ACTION_LIMIT", actionCount: 33, actionLimit: 32, sessionTotalTokens: 433512 }
    }, { sequence: 6, elapsedMs: 12, turn: 1, step: 33 });
    expect(record).toMatchObject({
      type: "circuit_breaker_tripped", code: "TURN_ACTION_LIMIT", actionCount: 33,
      actionLimit: 32, sessionTotalTokens: 433512
    });
  });

  it("ignores model text, caps the ring buffer and protects snapshots", () => {
    const trace = createAgentTrace({ limit: 2, now: () => 1 });
    expect(trace.observe({ type: "assistant_text", text: "private response" })).toBeNull();
    trace.observe({ type: "turn_start" });
    trace.observe({ type: "phase", detail: { phase: "planner" } });
    trace.observe({ type: "stopped" });
    const snapshot = trace.getSnapshot();
    expect(snapshot).toHaveLength(2);
    expect(snapshot.map((item) => item.type)).toEqual(["phase", "stopped"]);
    expect(() => snapshot.push({})).toThrow();
    expect(() => { snapshot[0].type = "changed"; }).toThrow();
    expect(trace.getSnapshot()[0].type).toBe("phase");
  });

  it("does not add a second message when runtime_error already reported the failure", () => {
    const outcome = {
      errorReported: true,
      result: { error: { code: "MAX_STEPS_EXCEEDED", message: "Action loop exceeded maxSteps" } }
    };
    expect(runtimeFailed(outcome)).toBeNull();
    expect(runtimeFailed({ ...outcome, errorReported: false })).toBeInstanceOf(Error);
    expect(translateAgentError(outcome.result.error.message)).toContain("configured step limit");
  });

  it("rejects untrusted labels even when they arrive in nominal metadata fields", () => {
    const record = sanitizeTraceEvent({
      type: "tool_result",
      phase: "SECRET_PHASE",
      cycle: 3,
      payload: { actionName: "secret_action", status: "customer-name", code: "gw_SECRET" },
      detail: { actionName: "printform_validate_project", ok: false }
    }, { sequence: 1, elapsedMs: 4, turn: 1, step: 1 });
    expect(record).toMatchObject({ action: "printform_validate_project", status: "error", cycle: 3 });
    expect(record).not.toHaveProperty("phase");
    expect(record).not.toHaveProperty("code");
  });

  it("turns a stream failure into one canonical reported error", async () => {
    const events = [];
    const controller = Object.create(DesignerRuntimeController.prototype);
    controller.onEvent = (event) => events.push(event);
    controller.session = async () => ({
      async *runStream() { throw Object.assign(new Error("Synthetic stream failure"), { code: "STREAM_FAILED" }); }
    });
    const outcome = await controller.consume({});
    expect(outcome.errorReported).toBe(true);
    expect(events.filter((event) => event.type === "runtime_error")).toEqual([
      { type: "runtime_error", detail: { code: "STREAM_FAILED", message: "The provider turn failed." } }
    ]);
    expect(runtimeFailed(outcome)).toBeNull();
  });

  it("does not expose raw prompt or multimodal URLs through events or outcomes", async () => {
    const events = [];
    const controller = Object.create(DesignerRuntimeController.prototype);
    controller.onEvent = (event) => events.push(event);
    controller.session = async () => ({
      getState: () => ({ cumulativeUsage: { totalTokens: 0 } }),
      async *runStream() {
        yield {
          type: "completed",
          detail: {
            terminalKind: "done",
            result: {
              input: { prompt: "ERP SECRET", parts: [{ url: "data:image/png;base64,SECRET" }] },
              output: { text: "safe answer" }
            }
          }
        };
      }
    });
    const outcome = await controller.consume({ prompt: "ERP SECRET" });
    const serialized = JSON.stringify({ events, outcome });
    expect(serialized).toContain("safe answer");
    expect(serialized).not.toContain("ERP SECRET");
    expect(serialized).not.toContain("base64,SECRET");
  });
});
