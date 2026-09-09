import { AgentHarness, BACKGROUND_CONTEXT } from "@earendil-works/pi-agent-core";
import { createModels, fauxAssistantMessage, fauxProvider } from "@earendil-works/pi-ai";
import { createDataPolicy } from "../core/data-policy.js";
import { IndexedDbSessionStorage } from "./indexed-db-storage.js";
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

async function runDelayedPolicySwitchProbe() {
  const contextId = `pi03-16-05-delayed-${crypto.randomUUID()}`;
  const environment = await createPi03Environment({ classification: "synthetic", contextId });
  let session;
  let created;
  let completion;
  let retiredSessionCountAfterClose;
  let retiredDatabaseCountAfterClose;
  try {
    session = await environment.repo.create({ id: "pi03-delayed-policy-session" }, BACKGROUND_CONTEXT);
    let release;
    let markStarted;
    const started = new Promise((resolve) => { markStarted = resolve; });
    environment.faux.setResponses([async () => {
      markStarted();
      await new Promise((resolve) => { release = resolve; });
      return fauxAssistantMessage("PI03-STALE-PROVIDER-CANARY", { stopReason: "stop" });
    }]);
    created = await AgentHarness.create({
      session, models: environment.models, model: environment.faux.getModel(), tools: [], activeToolNames: [],
      systemPrompt: "Use the session safely and finish the turn.", toolExecution: "sequential"
    }, BACKGROUND_CONTEXT);
    const lane = await created.harness.lane("main", BACKGROUND_CONTEXT);
    const pending = lane.prompt("Delayed policy boundary check.", BACKGROUND_CONTEXT);
    await started;
    environment.setPolicy(policyFor("real", contextId));
    release();
    try {
      const result = await pending;
      completion = { kind: "resolved", ok: result.ok, error: result.ok ? null : safeError(result.error) };
    } catch (error) {
      completion = { kind: "rejected", error: safeError(error), cause: safeError(error?.cause) };
    }
  } finally {
    await created?.harness.close(BACKGROUND_CONTEXT).catch(() => {});
    await session?.close(BACKGROUND_CONTEXT).catch(() => {});
    retiredSessionCountAfterClose = environment.repo.retiredSessions.size;
    retiredDatabaseCountAfterClose = environment.repo.retiredDatabases.size;
    await environment.close();
  }

  const restored = await createPi03Environment({ classification: "synthetic", contextId });
  try {
    const records = await restored.repo.list(undefined, BACKGROUND_CONTEXT);
    const reopened = records[0] ? await restored.repo.open(records[0], BACKGROUND_CONTEXT) : null;
    try {
      const entries = reopened ? await reopened.findEntries({ order: "asc" }, BACKGROUND_CONTEXT) : [];
      return {
        completion, providerCalls: environment.faux.state.callCount,
        retiredSessionCountAfterClose, retiredDatabaseCountAfterClose,
        restoredSessionCount: records.length, restoredEntryCount: entries.length,
        staleResponsePersisted: entries.some((entry) => JSON.stringify(entry).includes("PI03-STALE-PROVIDER-CANARY"))
      };
    } finally {
      await reopened?.close(BACKGROUND_CONTEXT).catch(() => {});
    }
  } finally {
    await restored.close();
  }
}

async function summarizeResult(promise) {
  try {
    const result = await promise;
    return { kind: "resolved", ok: Boolean(result?.ok), ...(result?.ok ? {} : { error: safeError(result?.error) }) };
  } catch (error) {
    return { kind: "rejected", error: safeError(error), cause: safeError(error?.cause) };
  }
}

async function runAbortedHarness() {
  const contextId = `pi03-16-05-abort-${crypto.randomUUID()}`;
  const environment = await createPi03Environment({ classification: "synthetic", contextId });
  let session;
  let created;
  let release;
  let abort;
  let run;
  try {
    session = await environment.repo.create({ id: "pi03-abort-session" }, BACKGROUND_CONTEXT);
    let markStarted;
    const started = new Promise((resolve) => { markStarted = resolve; });
    environment.faux.setResponses([async () => {
      markStarted();
      await new Promise((resolve) => { release = resolve; });
      return fauxAssistantMessage("PI03-ABORT-PROVIDER-CANARY", { stopReason: "stop" });
    }]);
    created = await AgentHarness.create({
      session, models: environment.models, model: environment.faux.getModel(), tools: [], activeToolNames: [],
      systemPrompt: "Use the session safely and finish the turn.", toolExecution: "sequential"
    }, BACKGROUND_CONTEXT);
    const lane = await created.harness.lane("main", BACKGROUND_CONTEXT);
    const pending = lane.prompt("Abort boundary check.", BACKGROUND_CONTEXT);
    await started;
    const aborting = summarizeResult(lane.abort(BACKGROUND_CONTEXT));
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const state = await lane.inspectExecution(BACKGROUND_CONTEXT);
      if (state.current?.status === "aborting") break;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    release?.();
    [abort, run] = await Promise.all([aborting, summarizeResult(pending)]);
  } finally {
    release?.();
    await created?.harness.close(BACKGROUND_CONTEXT).catch(() => {});
    await session?.close(BACKGROUND_CONTEXT).catch(() => {});
    await environment.close();
  }

  const restored = await createPi03Environment({ classification: "synthetic", contextId });
  try {
    const records = await restored.repo.list(undefined, BACKGROUND_CONTEXT);
    const reopened = records[0] ? await restored.repo.open(records[0], BACKGROUND_CONTEXT) : null;
    try {
      const entries = reopened ? await reopened.findEntries({ order: "asc" }, BACKGROUND_CONTEXT) : [];
      return {
        abort, run, providerCalls: environment.faux.state.callCount, restoredEntryCount: entries.length,
        abortCanaryPersisted: entries.some((entry) => JSON.stringify(entry).includes("PI03-ABORT-PROVIDER-CANARY"))
      };
    } finally {
      await reopened?.close(BACKGROUND_CONTEXT).catch(() => {});
    }
  } finally {
    await restored.close();
  }
}

async function runRepeatedPolicyLifecycle() {
  const contextId = `pi03-16-05-repeat-${crypto.randomUUID()}`;
  const environment = await createPi03Environment({ classification: "synthetic", contextId });
  let session;
  let stale;
  let retiredSessionCountAfterClose;
  let retiredDatabaseCountAfterClose;
  try {
    session = await environment.repo.create({ id: "pi03-repeat-session" }, BACKGROUND_CONTEXT);
    environment.setPolicy(policyFor("real", contextId));
    stale = await session.getStats(BACKGROUND_CONTEXT).then(() => null, safeError);
    environment.setPolicy(null);
    const missingPolicyMode = environment.repo.describe().mode;
    environment.setPolicy(policyFor("synthetic", contextId));
    await session.close(BACKGROUND_CONTEXT);
    retiredSessionCountAfterClose = environment.repo.retiredSessions.size;
    retiredDatabaseCountAfterClose = environment.repo.retiredDatabases.size;
    const followup = await runActualHarness(environment, { sessionId: "pi03-repeat-followup", prompt: "Run after repeated policy changes." });
    return {
      stale, missingPolicyMode, modeAfterReenable: environment.repo.describe().mode, followupOk: followup.run.ok,
      retiredSessionCountAfterClose, retiredDatabaseCountAfterClose
    };
  } finally {
    await session?.close(BACKGROUND_CONTEXT).catch(() => {});
    await environment.close();
  }
}

async function runDelayedSessionOpenPolicySwitch() {
  const contextId = `pi03-16-05-open-${crypto.randomUUID()}`;
  const environment = await createPi03Environment({ classification: "synthetic", contextId });
  let seed;
  let release;
  const originalOpen = IndexedDbSessionStorage.open;
  try {
    seed = await environment.repo.create({ id: "pi03-delayed-open-session" }, BACKGROUND_CONTEXT);
    const metadata = seed.metadata;
    await seed.close(BACKGROUND_CONTEXT);
    let markReady;
    const ready = new Promise((resolve) => { markReady = resolve; });
    IndexedDbSessionStorage.open = async (options) => {
      const storage = await originalOpen(options);
      markReady();
      await new Promise((resolve) => { release = resolve; });
      return storage;
    };
    const opening = environment.repo.open(metadata, BACKGROUND_CONTEXT);
    await ready;
    environment.setPolicy(policyFor("real", contextId));
    release?.();
    const stale = await opening.then(() => null, safeError);
    IndexedDbSessionStorage.open = originalOpen;
    const reopenedEnvironment = await createPi03Environment({ classification: "synthetic", contextId });
    try {
      const reopened = await reopenedEnvironment.repo.open(metadata, BACKGROUND_CONTEXT);
      try {
        await reopened.setName("reopened after stale open", BACKGROUND_CONTEXT);
        return { stale, reopenedName: await reopened.getName(BACKGROUND_CONTEXT) };
      } finally {
        await reopened.close(BACKGROUND_CONTEXT).catch(() => {});
      }
    } finally {
      await reopenedEnvironment.close();
    }
  } finally {
    IndexedDbSessionStorage.open = originalOpen;
    release?.();
    await seed?.close(BACKGROUND_CONTEXT).catch(() => {});
    await environment.close();
  }
}

export async function runDelayedHarnessPolicySwitch() {
  const delayed = await runDelayedPolicySwitchProbe();
  return {
    ...delayed, abort: await runAbortedHarness(), repeated: await runRepeatedPolicyLifecycle(),
    sessionOpenRace: await runDelayedSessionOpenPolicySwitch()
  };
}
