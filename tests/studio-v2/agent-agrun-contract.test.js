import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makePrintFormActions } from "../../studio-v2/ui/agent-actions.js";
import { projectRuntimeEvent } from "../../studio-v2/ui/agent-runtime-events.js";

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

function gateway() {
  return {
    async execute(name) {
      if (name === "preview_changes") {
        return {
          ok: true,
          result: {
            revision: 4,
            candidateHash: "candidate-hash",
            diff: { changed: true },
            validation: { valid: true, errors: [], warnings: [] }
          }
        };
      }
      throw new Error(`Unexpected gateway command: ${name}`);
    }
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PrintForm AGRUN action-result contract", () => {
  it("terminates the real AGRUN loop with the preview terminal envelope", async () => {
    const actions = makePrintFormActions({
      Agrun,
      gateway: gateway(),
      createProposal: async (proposal) => proposal,
      onFailure: vi.fn()
    });
    const preview = actions.find((action) => action.name === "printform_preview_changes");
    let plannerRequests = 0;
    vi.stubGlobal("fetch", vi.fn(async (_url, init = {}) => {
      plannerRequests += 1;
      const request = JSON.parse(init.body);
      expect(request.tool_choice).toBe("auto");
      const id = "chatcmpl-printform-contract";
      return streamResponse([
        { id, object: "chat.completion.chunk", created: 1770000000, model: "gpt-mock", choices: [{ index: 0, delta: { role: "assistant", tool_calls: [{ index: 0, id: "call-preview", type: "function", function: { name: "printform_preview_changes", arguments: "{\"expectedRevision\":" } }] }, finish_reason: null }] },
        { id, object: "chat.completion.chunk", created: 1770000000, model: "gpt-mock", choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: "4,\"operations\":[{\"type\":\"set_brand_color\",\"hex\":\"#b45309\"}]}" } }] }, finish_reason: null }] },
        { id, object: "chat.completion.chunk", created: 1770000000, model: "gpt-mock", choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: "}" } }] }, finish_reason: "tool_calls" }], usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 } }
      ]);
    }));

    const runtime = Agrun.createRuntime({
      sessionStore: Agrun.createInMemorySessionStore(),
      globalMemory: { enabled: false },
      customActions: [preview],
      actionPolicy: { printform_preview_changes: "allow" },
      plannerMode: "native_tools",
      nativeToolsFailurePolicy: "hard_fail",
      maxSteps: 4
    });
    const session = await runtime.createSession({ id: "printform-contract" });
    const events = [];
    const streamEvents = [];
    const stream = session.runStream({
      provider: "openai", apiKey: "test-key", model: "gpt-mock", apiVariant: "chat", prompt: "preview"
    }, { onStreamEvent: (event) => streamEvents.push(event) });
    for await (const event of stream) events.push(event);
    const completed = events.find((event) => event.type === "completed");
    const streamedAction = streamEvents.find((event) => event.type === "action-executed");
    const executedEvent = completed?.detail?.result?.steps?.find((event) => event.type === "action-executed");
    const executed = executedEvent?.detail;
    const projected = projectRuntimeEvent(executedEvent);

    expect(plannerRequests).toBe(1);
    expect(streamedAction).toMatchObject({ actionName: "printform_preview_changes", control: "complete", kind: "printform_result", status: "success" });
    expect(completed?.detail?.error).toBeNull();
    expect(completed?.detail).toMatchObject({
      terminalKind: "done",
      result: { finalAnswerSource: "printform_preview_changes", output: { kind: "printform_result" } }
    });
    expect(executed).toMatchObject({
      actionName: "printform_preview_changes",
      control: "complete",
      status: "success",
      kind: "printform_result",
      resultEnvelopeVersion: "v1"
    });
    expect(projected?.detail).toMatchObject({
      actionName: "printform_preview_changes", control: "complete",
      status: "success", kind: "printform_result", resultEnvelopeVersion: "v1"
    });
  });
});
