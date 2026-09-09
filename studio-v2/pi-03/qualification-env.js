import { AgentHarness, BACKGROUND_CONTEXT } from "@earendil-works/pi-agent-core";
import { createModels, fauxAssistantMessage, fauxProvider } from "@earendil-works/pi-ai";
import { createDataPolicy } from "../core/data-policy.js";
import { PolicySessionRepo } from "./policy-session-repo.js";

export const PI03_PIN = Object.freeze({
  sourceCommit: "b2602be77cb7b0de45dd616407fd210daa48aa75",
  agentPackage: "@earendil-works/pi-agent-core@0.85.1",
  aiPackage: "@earendil-works/pi-ai@0.85.1",
  storage: "IndexedDbSessionStorage",
  memoryRepo: "MemorySessionRepo",
  namespace: "printform-pi-session-v1-*",
  appBackend: false,
  providerProxy: false
});

export const PI03_CONTEXT = "pi03-qualification-context";

export function browserRuntime() {
  return {
    process: typeof globalThis.process,
    require: typeof globalThis.require,
    Buffer: typeof globalThis.Buffer,
    nodeGlobalsAbsent: [globalThis.process, globalThis.require, globalThis.Buffer].every((value) => value === undefined)
  };
}

export function policyFor(classification, contextId = PI03_CONTEXT) {
  return createDataPolicy({ classification, documentId: "pi03-qualification", context: contextId });
}

export async function createPi03Environment({ classification = "synthetic", contextId = PI03_CONTEXT, openTimeoutMs = 5000 } = {}) {
  const policy = policyFor(classification, contextId);
  let currentPolicy = policy;
  const repo = new PolicySessionRepo({ dataPolicy: policy, getDataPolicy: () => currentPolicy, openTimeoutMs });
  const faux = fauxProvider({ provider: "pi03-faux", models: [{ id: "pi03-qualification" }], tokenSize: { min: 3, max: 3 } });
  const models = createModels();
  models.setProvider(faux.provider);
  return {
    policy,
    repo,
    faux,
    models,
    setPolicy(next) { currentPolicy = next; repo.setDataPolicy(next); },
    currentPolicy: () => currentPolicy,
    async close() { await repo.close(BACKGROUND_CONTEXT); }
  };
}

export async function runActualHarness(environment, { sessionId = "pi03-harness-session", prompt = "Record one session message." } = {}) {
  const session = await environment.repo.create({ id: sessionId }, BACKGROUND_CONTEXT);
  environment.faux.setResponses([fauxAssistantMessage("PI-03 completed", { stopReason: "stop" })]);
  const created = await AgentHarness.create({
    session,
    models: environment.models,
    model: environment.faux.getModel(),
    tools: [],
    activeToolNames: [],
    systemPrompt: "Use the session safely and finish the turn.",
    toolExecution: "sequential"
  }, BACKGROUND_CONTEXT);
  const lane = await created.harness.lane("main", BACKGROUND_CONTEXT);
  const run = await lane.prompt(prompt, BACKGROUND_CONTEXT);
  const entries = await session.findEntries({ order: "asc" }, BACKGROUND_CONTEXT);
  const stats = await session.getStats(BACKGROUND_CONTEXT);
  await created.harness.close(BACKGROUND_CONTEXT);
  await session.close(BACKGROUND_CONTEXT);
  return { run, entries: entries.map((entry) => ({ type: entry.type, role: entry.message?.role || null, seq: entry.seq })), stats };
}

export function safeError(error) {
  return { code: error?.code || error?.name || "QUALIFICATION_FAILED" };
}
