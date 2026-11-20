import { revisionConflict } from "./history.js";
import { projectContentHash } from "./transaction-common.js";
import { assertBusPolicyCurrent, assertContextCurrent } from "./agent-boundary.js";

export async function navigateHistory(bus, direction, expectedRevision, context = null) {
  bus.assertCurrent?.();
  assertContextCurrent(context);
  assertBusPolicyCurrent(bus, context);
  const navigation = bus.history.peekNavigation(direction, expectedRevision);
  if (!navigation.changed) return { changed: false, revision: navigation.revision, project: navigation.project };

  bus.ensureRevision(expectedRevision);
  const nextProject = structuredClone(navigation.project);
  const nextRevision = expectedRevision + 1;
  nextProject.revision = nextRevision;
  const head = bus.transactionStore.head;
  const nextProjectHash = await projectContentHash(nextProject);
  bus.assertCurrent?.();
  assertContextCurrent(context);
  assertBusPolicyCurrent(bus, context);
  const cas = bus.transactionStore.compareAndSwapHead({
    expectedRevision,
    expectedProjectHash: head.project_hash,
    nextProject,
    nextProjectHash,
    reason: `history:${direction}`,
  });
  if (!cas.ok) throw revisionConflict(expectedRevision, cas.actualRevision);

  const result = bus.history.applyNavigation(navigation.targetCursor, cas.revision);
  bus.renderReport = null;
  bus.reviewReceipt = null;
  bus.reviewAttempts = 0;
  bus.evidenceReceipts.clear();
  bus.evidencePack = null;
  bus.transactionJournal.append({
    type: direction === "undo" ? "UNDO" : "REDO",
    revision: result.revision,
    agent_id: bus.agentId,
  });
  bus.dispatchEvent(new CustomEvent("change", { detail: { revision: result.revision, project: result.project, reason: direction } }));
  return result;
}
