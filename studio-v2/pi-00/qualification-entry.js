import {
  AgentHarness,
  BACKGROUND_CONTEXT,
  MemorySessionRepo
} from "@earendil-works/pi-agent-core";
import {
  Type,
  createModels,
  fauxAssistantMessage,
  fauxProvider,
  fauxText,
  fauxToolCall
} from "@earendil-works/pi-ai";

const CONTEXT = BACKGROUND_CONTEXT;
const QUALIFICATION_KEY = "__PI_00_QUALIFICATION__";
const PIN = Object.freeze({
  sourceCommit: "b2602be77cb7b0de45dd616407fd210daa48aa75",
  agentPackage: "@earendil-works/pi-agent-core@0.85.1",
  aiPackage: "@earendil-works/pi-ai@0.85.1",
  publicImports: ["@earendil-works/pi-agent-core", "@earendil-works/pi-ai"]
});

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

function browserRuntime() {
  return {
    process: typeof globalThis.process,
    require: typeof globalThis.require,
    Buffer: typeof globalThis.Buffer,
    nodeGlobalsAbsent: [globalThis.process, globalThis.require, globalThis.Buffer].every((value) => value === undefined)
  };
}

async function createQualificationHarness(faux, options = {}) {
  const { laneName = "main", ...harnessOptions } = options;
  const sessionRepo = new MemorySessionRepo();
  const session = await sessionRepo.create({}, CONTEXT);
  const models = createModels();
  models.setProvider(faux.provider);
  const created = await AgentHarness.create({
    session,
    models,
    model: faux.getModel(),
    ...harnessOptions
  }, CONTEXT);
  const lane = await created.harness.lane(laneName, CONTEXT);
  return { created, lane, sessionRepo, session };
}

async function runToolCycle() {
  const faux = fauxProvider({
    provider: "pi00-faux-tool",
    models: [{ id: "qualification-tool" }]
  });
  faux.setResponses([
    fauxAssistantMessage([fauxToolCall("echo", { value: "ok" }, { id: "call-1" })], { stopReason: "toolUse" }),
    fauxAssistantMessage("tool-cycle-complete", { stopReason: "stop" })
  ]);
  const tool = {
    name: "echo",
    label: "Echo",
    description: "Return the supplied value.",
    parameters: Type.Object({ value: Type.String() }),
    execute: async (toolCallId, params, onUpdate, toolContext, invocation) => ({
      content: [fauxText(`echo:${params.value}`)],
      details: { toolCallId, invocationId: invocation.invocationId, value: params.value }
    })
  };
  const qualification = await createQualificationHarness(faux, {
    tools: [tool],
    activeToolNames: ["echo"],
    laneName: "tool-cycle",
    systemPrompt: "Use the scripted tool call."
  });
  let toolEnds = 0;
  const off = qualification.created.harness.events.on("tool_end", () => { toolEnds += 1; });
  try {
    const result = await qualification.lane.prompt("call echo", CONTEXT);
    return {
      passed: result.ok && result.value.status === "completed" && faux.state.callCount === 2 && toolEnds === 1,
      result,
      toolEnds,
      providerCalls: faux.state.callCount,
      laneName: qualification.lane.name,
      sessionType: qualification.sessionRepo.constructor.name,
      memorySession: qualification.sessionRepo instanceof MemorySessionRepo
    };
  } finally {
    off();
    await qualification.created.harness.close(CONTEXT);
  }
}

async function runAbortCycle() {
  const faux = fauxProvider({
    provider: "pi00-faux-abort",
    models: [{ id: "qualification-abort" }],
    tokensPerSecond: 1,
    tokenSize: { min: 1, max: 1 }
  });
  faux.setResponses([fauxAssistantMessage("abort-qualification-".repeat(100), { stopReason: "stop" })]);
  const qualification = await createQualificationHarness(faux, {
    laneName: "abort"
  });
  let started;
  const runStarted = new Promise((resolve) => { started = resolve; });
  const off = qualification.created.harness.events.on("run_start", (event) => started(event.runId));
  const pending = qualification.lane.prompt("start a slow response", CONTEXT);
  try {
    await Promise.race([runStarted, delay(1500)]);
    await delay(50);
    const abort = await qualification.lane.abort(CONTEXT);
    const result = await pending;
    return {
      passed: abort.ok && result.ok && result.value.status === "aborted",
      abort,
      result,
      providerCalls: faux.state.callCount
    };
  } finally {
    off();
    await qualification.created.harness.close(CONTEXT);
  }
}

async function runQualification() {
  const result = {
    id: "PI-00",
    status: "failed",
    pin: PIN,
    browser: browserRuntime(),
    actualHarness: typeof AgentHarness.create === "function",
    actualMemorySessionRepo: typeof MemorySessionRepo === "function",
    toolCycle: null,
    abortCycle: null,
    error: null
  };
  try {
    result.toolCycle = await runToolCycle();
    result.abortCycle = await runAbortCycle();
    result.status = result.browser.nodeGlobalsAbsent && result.actualHarness && result.actualMemorySessionRepo &&
      result.toolCycle.passed && result.toolCycle.memorySession && result.abortCycle.passed ? "passed" : "failed";
  } catch (error) {
    result.error = errorText(error);
  }
  globalThis[QUALIFICATION_KEY] = result;
  const output = document.querySelector("#qualification-result");
  if (output) output.textContent = JSON.stringify(result, null, 2);
  return result;
}

globalThis.__PI_00_QUALIFICATION_PROMISE__ = runQualification();
