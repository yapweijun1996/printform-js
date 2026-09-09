import { expect, test } from "@playwright/test";

async function openQualification(page) {
  const externalRequests = [];
  page.on("request", (request) => {
    if (/^https?:/u.test(request.url()) && !request.url().startsWith("http://127.0.0.1")) externalRequests.push(request.url());
  });
  await page.goto("/studio-v2/pi-04/");
  const runtime = await page.evaluate(() => {
    const qualification = globalThis.__PI_04_QUALIFICATION__;
    return { id: qualification.id, status: qualification.status, browser: qualification.browser,
      actualHarness: qualification.actualHarness, policyBound: qualification.policyBound, frontendOnly: qualification.frontendOnly, pin: qualification.pin };
  });
  return { runtime, externalRequests };
}

test.describe("Studio v2 PI-04 composed acceptance", () => {
  test("17-01 completes X-01 through actual PI, policy session, approval, review and human export", async ({ page, request }) => {
    const opened = await openQualification(page);
    const result = await page.evaluate(async () => globalThis.__PI_04_QUALIFICATION__.runCase("17-01"));
    console.log(`PI04RESULT ${JSON.stringify(result)}`);
    expect(opened.runtime).toMatchObject({ id: "PI-04", status: "ready", actualHarness: true, policyBound: true, frontendOnly: true, browser: { nodeGlobalsAbsent: true } });
    expect(result).toMatchObject({ caseId: "17-01", status: "passed", result: {
      mode: "preview", policy: "unknown", scope: { kind: "table", tableId: "a" }, sessionMode: "memory",
      providerCalls: 2, providerSawCanary: false, noCanaryInQualificationOutput: true,
      noUnauthorizedCanaryPersistence: true, noUnauthorizedCanaryExposure: true,
      revision: 1, revisionEntries: [0, 1], readiness: "ready", export: {
        ok: true, mode: "saved", evidenceRevision: 1, embeddedRevision: 1, confirmCalls: 2,
        saveStates: ["saving", "saved"]
      }
    } });
    expect(result.result.firstRun.ok).toBe(true);
    expect(result.result.applied).toMatchObject({ ok: true, revision: 1 });
    expect(result.result.render).toMatchObject({ status: "ready", revision: 1, visualMode: "geometry" });
    expect(result.result.review).toMatchObject({ attempt: 1, evidenceCount: 2, run: { ok: true } });
    expect(result.result.calls).toEqual(expect.arrayContaining([
      { surface: "agent", name: "preview_changes" },
      { surface: "human", name: "approve_transaction" },
      { surface: "human", name: "apply_changes" },
      { surface: "agent", name: "begin_layout_review" },
      { surface: "agent", name: "capture_layout_evidence" },
      { surface: "agent", name: "complete_layout_review" }
    ]));
    expect(opened.externalRequests).toEqual([]);
    const bundle = await (await request.get("/studio-v2/pi-04/qualification-entry.js")).text();
    const manifest = await (await request.get("/studio-v2/pi-04/qualification-manifest.json")).json();
    expect(bundle).not.toMatch(/from\s*["']@earendil-works\/pi-/u);
    expect(bundle).not.toMatch(/from\s*["']node:/u);
    expect(bundle).not.toMatch(/\beval\s*\(/u);
    expect(bundle).not.toContain("new Function");
    expect(manifest).toMatchObject({ id: "PI-04", static: true, frontendOnly: true, appBackend: false, providerProxy: false, actualHarness: true, policyBound: true, privateHumanApproval: true, canonicalCommandBus: true, x01: true, liveByokSmoke: false });
    expect(manifest.bytes).toBe(Buffer.byteLength(bundle));
  });
});
