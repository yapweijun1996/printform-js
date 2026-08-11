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
});
