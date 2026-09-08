import { expect, test } from "@playwright/test";
import { openEditor } from "./studio-v2-helpers.js";
import { readClientStorage } from "./studio-v2-storage-inspection.js";

const CANARIES = Object.freeze({
  durable: "LEGACY-DURABLE-CANARY-20260908",
  other: "UNRELATED-PROJECT-CANARY-20260908",
  recovery: "LEGACY-RECOVERY-CANARY-20260908",
  session: "LEGACY-SESSION-CANARY-20260908",
  realSession: "NEW-REAL-SESSION-CANARY-20260908",
  cache: "LEGACY-CACHE-CANARY-20260908",
  sessionStorage: "LEGACY-SESSION-STORAGE-CANARY-20260908"
});

async function seedLegacyRecords(page) {
  return page.evaluate(async (canaries) => {
    const { createSalesInvoiceProject } = await import("/studio-v2/samples/sales-invoice.js");
    const { DurableTransactionStore } = await import("/studio-v2/core/durable-transaction-store.js");
    const { journalKey } = await import("/studio-v2/core/transaction-journal.js");
    const { AgentSessionManager, sessionDatabaseName } = await import("/studio-v2/ui/agent-sessions.js");
    const { classifyRealDocument, classifySyntheticDocument } = await import("/studio-v2/core/data-policy.js");
    const { saveRecoveryDraft } = await import("/studio-v2/ui/draft-cache.js");

    function createLegacyStore(documentId, title, transactionId) {
      const base = createSalesInvoiceProject();
      base.manifest.documentId = documentId;
      const next = structuredClone(base);
      next.manifest.title = title;
      const store = new DurableTransactionStore({
        storage: localStorage,
        key: DurableTransactionStore.keyFor(journalKey(base)),
        formId: documentId,
        initialProject: base
      });
      expectStore(store.compareAndSwapHead({
        expectedRevision: 0,
        nextProject: next,
        nextProjectHash: `${transactionId}-hash`,
        transactionId,
        reason: "legacy synthetic fixture"
      }), transactionId);
      store.saveTransaction({
        transaction_id: transactionId,
        status: "committed",
        base_revision: 0,
        working_revision: 1,
        candidate_hash: `${transactionId}-hash`,
        project: next,
        patches: [{ type: "set_manifest_title", value: title }]
      });
      store.appendAudit({ type: "legacy_fixture", transaction_id: transactionId, detail: title });
      return store.key;
    }

    function expectStore(result, transactionId) {
      if (!result?.ok) throw new Error(`Could not seed ${transactionId}`);
    }

    const durableKey = createLegacyStore("legacy-record-project", canaries.durable, "legacy-record-tx");
    const unrelatedKey = createLegacyStore("unrelated-record-project", canaries.other, "unrelated-record-tx");
    const recoveryProject = createSalesInvoiceProject();
    recoveryProject.manifest.documentId = "legacy-recovery-project";
    recoveryProject.manifest.title = canaries.recovery;
    const recoveryPolicy = classifySyntheticDocument(recoveryProject.manifest.documentId);
    if (!saveRecoveryDraft(recoveryProject, "legacy-recovery-fingerprint", { policy: recoveryPolicy })) {
      throw new Error("Could not seed the recovery fixture");
    }

    const sessions = new AgentSessionManager({ dataPolicy: classifySyntheticDocument("legacy-session-project") });
    const legacySession = await sessions.create(canaries.session);
    const runtimeStore = sessions.createStore(window.Agrun, legacySession.id);
    await runtimeStore.createSession({ id: legacySession.id, version: 0 });
    await runtimeStore.appendMessage({ id: "legacy-message", sessionId: legacySession.id, role: "user", content: canaries.session });
    const sessionDbName = sessionDatabaseName(legacySession.id, sessions.contextId);
    sessions.setDataPolicy(classifyRealDocument("legacy-session-project"));
    const realSession = await sessions.create(canaries.realSession);

    const cacheName = "printform-legacy-records";
    const cacheUrl = new URL("/legacy-records.html", location.origin).href;
    const cache = await caches.open(cacheName);
    await cache.put(cacheUrl, new Response(canaries.cache, { headers: { "content-type": "text/html" } }));
    sessionStorage.setItem("legacy:session-record", canaries.sessionStorage);
    return { durableKey, unrelatedKey, sessionDbName, cacheName, cacheUrl, legacySession, realSession };
  }, CANARIES);
}

test("PROD-13 13-05 preserves exact old records while Real mode blocks new persistence", async ({ page }) => {
  await page.goto("/studio-v2/");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  const seeded = await seedLegacyRecords(page);

  await page.reload();
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  await expect(page.locator("#restore-banner")).not.toHaveClass(/hidden/);
  const beforeSwitch = await page.evaluate(async () => ({
    summary: await window.PrintFormStudioAgent.execute("get_project_summary"),
    editor: document.querySelector("#manifest-editor").value,
    recovery: localStorage.getItem("printform-studio-v2-recovery")
  }));
  expect(JSON.stringify({ summary: beforeSwitch.summary, editor: beforeSwitch.editor })).not.toContain(CANARIES.recovery);
  expect(beforeSwitch.recovery).toContain(CANARIES.recovery);

  const storageBeforePolicy = await readClientStorage(page);
  await openEditor(page);
  await page.locator("label.privacy-toggle").click();
  await expect(page.locator("#data-policy")).toHaveText(/Real data|真实数据/i);
  const realSession = await page.evaluate(async (canaries) => {
    const { AgentSessionManager } = await import("/studio-v2/ui/agent-sessions.js");
    const { classifyRealDocument } = await import("/studio-v2/core/data-policy.js");
    const manager = new AgentSessionManager({ dataPolicy: classifyRealDocument("legacy-session-project") });
    return manager.create(canaries.realSession);
  }, CANARIES);
  const afterSwitch = await readClientStorage(page);
  const afterSwitchText = JSON.stringify(afterSwitch);
  expect(Object.keys(afterSwitch.local).sort()).toEqual(Object.keys(storageBeforePolicy.local).sort());
  expect(Object.keys(afterSwitch.session).sort()).toEqual(Object.keys(storageBeforePolicy.session).sort());
  expect(afterSwitch.databases).toEqual(storageBeforePolicy.databases);
  expect(afterSwitch.cacheNames).toEqual(storageBeforePolicy.cacheNames);
  expect(realSession.label).toBe(CANARIES.realSession);
  expect(afterSwitchText).toContain(CANARIES.durable);
  expect(afterSwitchText).toContain(CANARIES.other);
  expect(afterSwitchText).toContain(CANARIES.session);
  expect(afterSwitchText).toContain(CANARIES.cache);
  expect(afterSwitchText).toContain(CANARIES.sessionStorage);
  expect(afterSwitchText).not.toContain(CANARIES.realSession);
  expect(afterSwitch.local[seeded.durableKey]).toContain(CANARIES.durable);
  expect(afterSwitch.local[seeded.unrelatedKey]).toContain(CANARIES.other);
  expect(afterSwitch.cacheEntries.find((entry) => entry.url === seeded.cacheUrl)?.body).toBe(CANARIES.cache);
  expect(afterSwitch.indexedDb.some(({ name, stores }) => name === seeded.sessionDbName
    && JSON.stringify(stores).includes(CANARIES.session))).toBe(true);

  await page.locator("#discard-restore-button").click();
  await expect(page.locator("#restore-banner")).toHaveClass(/hidden/);
  const afterExplicitCleanup = await readClientStorage(page);
  const cleanupText = JSON.stringify(afterExplicitCleanup);
  expect(afterExplicitCleanup.local["printform-studio-v2-recovery"]).toBeUndefined();
  expect(cleanupText).toContain(CANARIES.durable);
  expect(cleanupText).toContain(CANARIES.other);
  expect(cleanupText).toContain(CANARIES.session);
  expect(cleanupText).toContain(CANARIES.cache);
  expect(cleanupText).toContain(CANARIES.sessionStorage);
  expect(cleanupText).not.toContain(CANARIES.recovery);
});
