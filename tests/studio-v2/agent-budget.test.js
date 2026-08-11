import { describe, expect, it } from "vitest";
import { createTurnGuard, subtractUsage, usageFromSessionState } from "../../studio-v2/ui/agent-budget.js";
import { DesignerRuntimeController } from "../../studio-v2/ui/agent-runtime.js";

describe("AI Designer usage and safety budget", () => {
  it("reports the current turn as a delta from session cumulative usage", () => {
    const before = { cumulativeUsage: { inputTokens: 100, outputTokens: 40, totalTokens: 140, turnCount: 2 } };
    const after = { cumulativeUsage: { inputTokens: 160, outputTokens: 55, totalTokens: 215, turnCount: 3 } };
    expect(subtractUsage(usageFromSessionState(after), usageFromSessionState(before))).toEqual({ inputTokens: 60, outputTokens: 15, totalTokens: 75 });
  });

  it("hard-stops a configured 100-step planner at the eight-action ceiling", () => {
    const guard = createTurnGuard({ maxSteps: 100 });
    for (let step = 1; step <= 8; step += 1) expect(guard.observe({ type: "tool_start", detail: { actionName: `printform_action_${step}` } })).toBeNull();
    const stopped = guard.observe({ type: "tool_start", detail: { actionName: "printform_final_action" } });
    expect(stopped).toMatchObject({ code: "TURN_ACTION_LIMIT", budget: { actionCount: 9, actionLimit: 8 } });
  });

  it("stops repeated PrintForm actions before the planner consumes the full ceiling", () => {
    const guard = createTurnGuard({ maxSteps: 100, repeatLimit: 4 });
    for (let count = 1; count <= 3; count += 1) expect(guard.observe({ type: "tool_start", detail: { actionName: "printform_inspect_design_state" } })).toBeNull();
    expect(guard.observe({ type: "tool_start", detail: { actionName: "printform_inspect_design_state" } })).toMatchObject({ code: "REPEATED_ACTION" });
  });

  it("does not confuse different argument sets with a repeated action", () => {
    const guard = createTurnGuard({ maxSteps: 100, repeatLimit: 2 });
    expect(guard.observe({ type: "tool_start", detail: { actionName: "printform_preview_changes", args: { expectedRevision: 0 } } })).toBeNull();
    expect(guard.observe({ type: "tool_start", detail: { actionName: "printform_preview_changes", args: { expectedRevision: 1 } } })).toBeNull();
    expect(guard.observe({ type: "tool_start", detail: { actionName: "printform_preview_changes", args: { expectedRevision: 1 } } })).toMatchObject({ code: "REPEATED_ACTION" });
  });

  it("counts provider usage events toward the turn token guard", () => {
    const guard = createTurnGuard({ maxSteps: 100, tokenLimit: 100 });
    guard.observe({ type: "planner-responded", detail: { usage: { inputTokens: 60, outputTokens: 40, totalTokens: 100 } } });
    expect(guard.observe({ type: "tool_start", detail: { actionName: "printform_validate_project" } })).toMatchObject({ code: "TURN_TOKEN_LIMIT" });
  });

  it("checks the authoritative session delta when the stream exposes no usage event", () => {
    const guard = createTurnGuard({ maxSteps: 100, tokenLimit: 100 });
    expect(guard.observeFinalUsage({ totalTokens: 100 })).toMatchObject({ code: "TURN_TOKEN_LIMIT" });
  });

  it("emits current-turn usage separately from the persisted session total", async () => {
    let stateRead = 0;
    const events = [];
    const controller = Object.create(DesignerRuntimeController.prototype);
    controller.maxSteps = 100;
    controller.onEvent = (event) => events.push(event);
    controller.session = async () => ({
      getState: () => {
        stateRead += 1;
        return { cumulativeUsage: stateRead === 1 ? { inputTokens: 100, outputTokens: 20, totalTokens: 120 } : { inputTokens: 160, outputTokens: 35, totalTokens: 195 } };
      },
      async *runStream() {
        yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: "done" }, runState: { costLedger: { totals: { inputTokens: 60, outputTokens: 15, totalTokens: 75 } } } } } };
      }
    });
    const outcome = await controller.consume({});
    expect(outcome.errorReported).toBe(false);
    expect(events.find((event) => event.type === "usage")?.usage).toMatchObject({ totalTokens: 75, sessionTotalTokens: 195 });
  });

  it("reports a circuit breaker error before an action loop can reach 100 steps", async () => {
    const events = [];
    const controller = Object.create(DesignerRuntimeController.prototype);
    controller.maxSteps = 100;
    controller.onEvent = (event) => events.push(event);
    controller.session = async () => ({
      getState: () => ({ cumulativeUsage: { totalTokens: 0 } }),
      async *runStream() {
        for (let index = 0; index < 40; index += 1) yield { type: "tool_start", detail: { actionName: `printform_action_${index}` } };
      }
    });
    const outcome = await controller.consume({});
    expect(outcome.errorReported).toBe(true);
    expect(events.find((event) => event.type === "circuit_breaker_tripped")).toMatchObject({ detail: { code: "TURN_ACTION_LIMIT", actionCount: 9 } });
    expect(events.find((event) => event.type === "runtime_error")).toMatchObject({ detail: { code: "TURN_ACTION_LIMIT" } });
  });

  it("does not call the provider after a persisted chat reaches the session limit", async () => {
    const events = [];
    let called = false;
    const controller = Object.create(DesignerRuntimeController.prototype);
    controller.maxSteps = 100;
    controller.onEvent = (event) => events.push(event);
    controller.session = async () => ({
      getState: () => ({ cumulativeUsage: { totalTokens: 200000 } }),
      async *runStream() { called = true; yield { type: "completed", detail: { terminalKind: "done" } }; }
    });
    const outcome = await controller.consume({});
    expect(called).toBe(false);
    expect(outcome.errorReported).toBe(true);
    expect(events.find((event) => event.type === "usage")).toMatchObject({ usage: { totalTokens: 0, sessionTotalTokens: 200000 } });
    expect(events.find((event) => event.type === "circuit_breaker_tripped")).toMatchObject({ detail: { code: "SESSION_USAGE_LIMIT_REACHED" } });
  });
});
