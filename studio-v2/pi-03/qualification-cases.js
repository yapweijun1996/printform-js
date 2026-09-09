import { BACKGROUND_CONTEXT } from "@earendil-works/pi-agent-core";
import { createPi03Environment, policyFor, runActualHarness, safeError } from "./qualification-env.js";

function uniqueContext(caseId) { return `pi03-${caseId}-${crypto.randomUUID()}`; }

async function closeSession(session) { await session?.close(BACKGROUND_CONTEXT).catch(() => {}); }

async function policyModes() {
  const originalOpen = indexedDB.open;
  let storageOpens = 0;
  indexedDB.open = (...args) => { storageOpens += 1; return originalOpen.apply(indexedDB, args); };
  const environments = [];
  try {
    for (const classification of ["unknown", "real"]) {
      const environment = await createPi03Environment({ classification, contextId: uniqueContext(`16-01-${classification}`) });
      environments.push(environment);
      const run = await runActualHarness(environment, { sessionId: `pi03-${classification}`, prompt: "Keep this document-bearing chat volatile." });
      environment.lastRun = run;
    }
    const synthetic = await createPi03Environment({ classification: "synthetic", contextId: uniqueContext("16-01-synthetic") });
    environments.push(synthetic);
    return {
      unknown: { mode: environments[0].repo.describe().mode, entries: environments[0].lastRun.entries.length },
      real: { mode: environments[1].repo.describe().mode, entries: environments[1].lastRun.entries.length },
      synthetic: { mode: synthetic.repo.describe().mode, namespace: synthetic.repo.describe().namespace },
      storageOpens
    };
  } finally {
    indexedDB.open = originalOpen;
    await Promise.all(environments.map((environment) => environment.close()));
  }
}

async function persistentContract() {
  const contextId = uniqueContext("16-02");
  const sessionId = "pi03-persistent-session";
  const first = await createPi03Environment({ classification: "synthetic", contextId });
  const firstRun = await runActualHarness(first, { sessionId, prompt: "Persist one PI session turn." });
  await first.close();
  const second = await createPi03Environment({ classification: "synthetic", contextId });
  const metadata = (await second.repo.list(undefined, BACKGROUND_CONTEXT))[0];
  const session = await second.repo.open(metadata, BACKGROUND_CONTEXT);
  const entries = await session.findEntries({ order: "asc" }, BACKGROUND_CONTEXT);
  const stats = await session.getStats(BACKGROUND_CONTEXT);
  const mutation = await session.beginMutation(BACKGROUND_CONTEXT);
  await mutation.commit([], BACKGROUND_CONTEXT);
  const secondCommit = await mutation.commit([], BACKGROUND_CONTEXT).then(() => null, safeError);
  await mutation.end(BACKGROUND_CONTEXT);
  const result = {
    mode: second.repo.describe().mode, namespace: second.repo.describe().namespace,
    storageVersion: metadata.storageVersion, firstRun: { ok: firstRun.run.ok, entries: firstRun.entries.length },
    reopenedEntries: entries.map(({ seq, type, role }) => ({ seq, type, role })),
    sequenceIncreasing: entries.every((entry, index) => index === 0 || entry.seq > entries[index - 1].seq),
    messageCount: stats.messageCount, secondCommit
  };
  await closeSession(session);
  await second.close();
  return result;
}

async function legacyIsolation() {
  const environment = await createPi03Environment({ classification: "synthetic", contextId: uniqueContext("16-03") });
  const legacy = environment.repo.readLegacyHistory([{ id: "agrun-legacy-1", label: "Existing AGRUN chat", transcript: "LEGACY-CANARY" }]);
  const before = await environment.repo.list(undefined, BACKGROUND_CONTEXT);
  const fresh = await environment.repo.continueLegacy(legacy[0], BACKGROUND_CONTEXT);
  const freshEntries = await fresh.findEntries({ order: "asc" }, BACKGROUND_CONTEXT);
  const after = await environment.repo.list(undefined, BACKGROUND_CONTEXT);
  const result = {
    legacy, beforeCount: before.length, freshId: fresh.metadata.id, freshEntryCount: freshEntries.length,
    afterIds: after.map((record) => record.id), namespace: environment.repo.describe().namespace
  };
  await closeSession(fresh);
  await environment.close();
  return result;
}

async function storageFailure() {
  const contextId = uniqueContext("16-04");
  const environment = await createPi03Environment({ classification: "synthetic", contextId });
  const session = await environment.repo.create({ id: "pi03-failure-session" }, BACKGROUND_CONTEXT);
  environment.repo.failNextCommit(session.metadata.id);
  const failed = await session.setName("must not persist", BACKGROUND_CONTEXT).then(() => null, safeError);
  const nameAfterFailure = await session.getName(BACKGROUND_CONTEXT);
  const records = await environment.repo.list(undefined, BACKGROUND_CONTEXT);
  await closeSession(session);
  await environment.close();

  const originalOpen = indexedDB.open;
  let openAttempts = 0;
  indexedDB.open = () => { openAttempts += 1; return {}; };
  const blocked = await createPi03Environment({ classification: "synthetic", contextId: uniqueContext("16-04-open"), openTimeoutMs: 20 });
  const openFailure = await blocked.repo.create({ id: "pi03-open-failure" }, BACKGROUND_CONTEXT).then(() => null, safeError);
  indexedDB.open = originalOpen;
  await blocked.close();
  return { failed, nameAfterFailure, records: records.length, mode: environment.repo.describe().mode, openFailure, openAttempts };
}

async function lifecyclePolicyRace() {
  const environment = await createPi03Environment({ classification: "synthetic", contextId: uniqueContext("16-05") });
  const session = await environment.repo.create({ id: "pi03-stale-session" }, BACKGROUND_CONTEXT);
  environment.setPolicy(policyFor("real", "pi03-16-05-next"));
  const stale = await session.getStats(BACKGROUND_CONTEXT).then(() => null, safeError);
  const closedEnvironment = await createPi03Environment({ classification: "synthetic", contextId: uniqueContext("16-05-close") });
  const closed = await closedEnvironment.repo.create({ id: "pi03-closed-session" }, BACKGROUND_CONTEXT);
  await closeSession(closed);
  const disposed = await closed.getStats(BACKGROUND_CONTEXT).then(() => null, safeError);
  await environment.close();
  await closedEnvironment.close();
  return { stale, disposed, nextMode: environment.repo.describe().mode };
}

async function crossTabProtection() {
  const contextId = uniqueContext("16-06");
  const first = await createPi03Environment({ classification: "synthetic", contextId });
  const firstSession = await first.repo.create({ id: "pi03-cross-tab-session" }, BACKGROUND_CONTEXT);
  const metadata = firstSession.metadata;
  const second = await createPi03Environment({ classification: "synthetic", contextId });
  const conflict = await second.repo.open(metadata, BACKGROUND_CONTEXT).then(() => null, safeError);
  await closeSession(firstSession);
  await first.close();
  const reopened = await second.repo.open(metadata, BACKGROUND_CONTEXT);
  await reopened.setName("second writer after release", BACKGROUND_CONTEXT);
  const name = await reopened.getName(BACKGROUND_CONTEXT);
  await closeSession(reopened);
  await second.close();
  return { conflict, reopenedName: name, namespace: second.repo.describe().namespace, multiTabDurability: false };
}

const CASES = Object.freeze({
  "16-01": policyModes,
  "16-02": persistentContract,
  "16-03": legacyIsolation,
  "16-04": storageFailure,
  "16-05": lifecyclePolicyRace,
  "16-06": crossTabProtection
});

export async function runPi03Case(caseId) {
  const run = CASES[caseId];
  if (!run) throw Object.assign(new Error(`Unknown PI-03 case: ${caseId}`), { code: "PI03_CASE_UNKNOWN" });
  return run();
}
