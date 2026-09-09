import { expect, test } from "@playwright/test";

async function openQualification(page) {
  const externalRequests = [];
  page.on("request", (request) => {
    if (/^https?:/u.test(request.url()) && !request.url().startsWith("http://127.0.0.1")) externalRequests.push(request.url());
  });
  await page.goto("/studio-v2/pi-03/");
  const runtime = await page.evaluate(() => {
    const qualification = globalThis.__PI_03_QUALIFICATION__;
    return { id: qualification.id, status: qualification.status, browser: qualification.browser, actualHarness: qualification.actualHarness,
      actualMemorySessionRepo: qualification.actualMemorySessionRepo, actualStorageBackedSession: qualification.actualStorageBackedSession, pin: qualification.pin };
  });
  return { runtime, externalRequests };
}

async function runCase(page, caseId) {
  return page.evaluate(async (id) => globalThis.__PI_03_QUALIFICATION__.runCase(id), caseId);
}

test.describe("Studio v2 PI-03 policy-bound PI sessions", () => {
  test("16-01 selects memory for Unknown/Real and IndexedDB only for Synthetic", async ({ page, request }) => {
    const opened = await openQualification(page);
    const result = await runCase(page, "16-01");
    expect(opened.runtime).toMatchObject({ id: "PI-03", status: "ready", actualHarness: true, actualMemorySessionRepo: true, actualStorageBackedSession: true, browser: { nodeGlobalsAbsent: true } });
    expect(result).toMatchObject({ caseId: "16-01", status: "passed", result: { unknown: { mode: "memory" }, real: { mode: "memory" }, synthetic: { mode: "indexeddb" }, storageOpens: 0 } });
    expect(result.result.unknown.entries).toBeGreaterThan(0);
    expect(result.result.real.entries).toBeGreaterThan(0);
    expect(result.result.synthetic.namespace).toMatch(/^printform-pi-session-v1-/u);
    expect(opened.externalRequests).toEqual([]);
    const bundle = await (await request.get("/studio-v2/pi-03/qualification-entry.js")).text();
    const manifest = await (await request.get("/studio-v2/pi-03/qualification-manifest.json")).json();
    expect(bundle).not.toMatch(/from\s*["']@earendil-works\/pi-/u);
    expect(bundle).not.toMatch(/from\s*["']node:/u);
    expect(bundle).not.toMatch(/\beval\s*\(/u);
    expect(bundle).not.toContain("new Function");
    expect(manifest).toMatchObject({ id: "PI-03", static: true, appBackend: false, providerProxy: false, actualHarness: true, memorySession: true, indexedDbSession: true, policyBound: true, legacyReplay: false, crossTabWriterGuard: true });
    expect(manifest.bytes).toBe(Buffer.byteLength(bundle));
  });

  test("16-02 attaches the actual Harness to atomic PI IndexedDB storage and reopens it", async ({ page }) => {
    const opened = await openQualification(page);
    const result = await runCase(page, "16-02");
    expect(opened.externalRequests).toEqual([]);
    expect(result).toMatchObject({ caseId: "16-02", status: "passed", result: { mode: "indexeddb", storageVersion: 1, firstRun: { ok: true }, sequenceIncreasing: true, secondCommit: { code: "Error" } } });
    expect(result.result.reopenedEntries.length).toBeGreaterThan(0);
    expect(result.result.messageCount).toBeGreaterThan(0);
  });

  test("16-03 keeps AGRUN history read-only and starts a fresh PI transcript", async ({ page }) => {
    const opened = await openQualification(page);
    const result = await runCase(page, "16-03");
    expect(opened.externalRequests).toEqual([]);
    expect(result).toMatchObject({ caseId: "16-03", status: "passed", result: { beforeCount: 0, freshEntryCount: 0, legacy: [{ id: "agrun-legacy-1", legacy: true, readOnly: true, source: "AGRUN" }] } });
    expect(result.result.afterIds).toHaveLength(1);
    expect(result.result.afterIds).not.toContain("agrun-legacy-1");
    expect(result.result.namespace).toMatch(/^printform-pi-session-v1-/u);
  });

  test("16-04 fails storage errors closed without retry or volatile fallback", async ({ page }) => {
    const opened = await openQualification(page);
    const result = await runCase(page, "16-04");
    expect(opened.externalRequests).toEqual([]);
    expect(result).toMatchObject({ caseId: "16-04", status: "passed", result: { failed: { code: "PI_SESSION_COMMIT_FAILED" }, records: 1, mode: "indexeddb", openFailure: { code: "PI_SESSION_OPEN_TIMEOUT" }, openAttempts: 1 } });
    expect(result.result.nameAfterFailure).toBeUndefined();
  });

  test("16-05 invalidates disposed sessions and policy-raced late calls", async ({ page }) => {
    const opened = await openQualification(page);
    const result = await runCase(page, "16-05");
    expect(opened.externalRequests).toEqual([]);
    expect(result).toMatchObject({ caseId: "16-05", status: "passed", result: { stale: { code: "STALE_POLICY_CONTEXT" }, disposed: { code: "PI_SESSION_CLOSED" }, nextMode: "memory" } });
  });

  test("16-06 rejects a second Synthetic writer and allows a new writer after release", async ({ page }) => {
    const opened = await openQualification(page);
    const result = await runCase(page, "16-06");
    expect(opened.externalRequests).toEqual([]);
    expect(result).toMatchObject({ caseId: "16-06", status: "passed", result: { conflict: { code: "PI_SESSION_WRITER_CONFLICT" }, reopenedName: "second writer after release", multiTabDurability: false } });
    expect(result.result.namespace).toMatch(/^printform-pi-session-v1-/u);
  });
});
