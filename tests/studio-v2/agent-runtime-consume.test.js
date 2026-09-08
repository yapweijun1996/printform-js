import { describe, expect, it } from "vitest";
import { consumeRuntimeTurn } from "../../studio-v2/ui/agent-runtime-consume.js";

function controller(session, emitted) {
  return {
    session: async () => session,
    maxSteps: 4,
    abortController: null,
    running: false,
    actionFailure: null,
    pendingProposal: null,
    pendingApproval: null,
    emit: (event) => emitted.push(event),
    outputText: () => "",
    approvalFrom: () => null,
    captureToken: () => {},
    beforeFinalize: () => {},
    recoverInvalidPlannerOutput: () => {}
  };
}

describe("AI Designer runtime consumption", () => {
  it("projects the normalized terminal action from AGRUN result steps", async () => {
    const emitted = [];
    const session = {
      async *runStream() {
        yield {
          type: "completed",
          detail: {
            terminalKind: "done",
            error: null,
            result: {
              steps: [{
                type: "action-executed",
                detail: {
                  actionName: "printform_preview_changes",
                  control: "complete",
                  status: "success",
                  kind: "printform_result",
                  resultEnvelopeVersion: "v1",
                  body: { renderedText: "SECRET ERP CUSTOMER", amount: 91234.56 }
                }
              }]
            }
          }
        };
      }
    };

    const result = await consumeRuntimeTurn(controller(session, emitted), { prompt: "preview" });
    const action = emitted.find((event) => event.type === "action-executed");
    expect(result.completed.terminalKind).toBe("done");
    expect(action).toMatchObject({
      type: "action-executed",
      detail: {
        actionName: "printform_preview_changes",
        control: "complete",
        status: "success",
        kind: "printform_result",
        resultEnvelopeVersion: "v1"
      }
    });
    expect(JSON.stringify(action)).not.toContain("SECRET ERP CUSTOMER");
    expect(JSON.stringify(action)).not.toContain("91234.56");
  });

  it("does not start a provider stream after the host policy becomes stale", async () => {
    const emitted = [];
    let streamCalls = 0;
    const session = {
      runStream() {
        streamCalls += 1;
        return (async function* () { yield { type: "completed", detail: { terminalKind: "done" } }; }());
      }
    };
    const staleController = controller(session, emitted);
    staleController.assertCurrentPolicy = () => {
      throw Object.assign(new Error("stale policy"), { code: "STALE_POLICY_CONTEXT" });
    };

    const result = await consumeRuntimeTurn(staleController, { prompt: "do not send" });

    expect(streamCalls).toBe(0);
    expect(result.errorReported).toBe(true);
    expect(result.completed.error.code).toBe("STALE_POLICY_CONTEXT");
  });

  it("discards a delayed Provider result after the host policy changes", async () => {
    const emitted = [];
    let release;
    let markStarted;
    let current = true;
    const started = new Promise((resolve) => { markStarted = resolve; });
    const session = {
      runStream() {
        return (async function* () {
          markStarted();
          await new Promise((resolve) => { release = resolve; });
          yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: "CANARY-STALE-RESULT" } } } };
        }());
      }
    };
    const delayedController = controller(session, emitted);
    delayedController.outputText = (result) => result?.output?.text || "";
    delayedController.assertCurrentPolicy = () => {
      if (!current) throw Object.assign(new Error("stale policy"), { code: "STALE_POLICY_CONTEXT" });
    };

    const pending = consumeRuntimeTurn(delayedController, { prompt: "delayed" });
    await started;
    current = false;
    release();
    const result = await pending;

    expect(result.errorReported).toBe(true);
    expect(result.completed).toMatchObject({ terminalKind: "error", error: { code: "STALE_POLICY_CONTEXT" } });
    expect(result.result).toBeNull();
    expect(JSON.stringify(emitted)).not.toContain("CANARY-STALE-RESULT");
  });

  it("discards a delayed Provider result after Stop and reports an abort", async () => {
    const emitted = [];
    let release;
    let markStarted;
    const started = new Promise((resolve) => { markStarted = resolve; });
    const session = {
      runStream() {
        return (async function* () {
          markStarted();
          await new Promise((resolve) => { release = resolve; });
          yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: "CANARY-CANCELLED-RESULT" } } } };
        }());
      }
    };
    const cancelledController = controller(session, emitted);
    cancelledController.outputText = (result) => result?.output?.text || "";

    const pending = consumeRuntimeTurn(cancelledController, { prompt: "cancelled" });
    await started;
    cancelledController.actionFailure = Object.assign(new Error("cancelled"), { code: "TURN_CANCELLED" });
    cancelledController.abortController?.abort();
    release();
    const result = await pending;

    expect(result).toMatchObject({ errorReported: false, completed: { terminalKind: "abort" }, result: null });
    expect(emitted).toContainEqual({ type: "stopped" });
    expect(JSON.stringify(emitted)).not.toContain("CANARY-CANCELLED-RESULT");
  });
});
