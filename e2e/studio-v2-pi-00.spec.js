import { expect, test } from "@playwright/test";

test("PI-00 qualifies the actual Harness in a static browser build", async ({ page, request }) => {
  const unexpectedRequests = [];
  page.on("request", (requestEvent) => {
    const url = new URL(requestEvent.url());
    const forbiddenPath = /\/(?:api|mcp|transaction|gateway|proxy)(?:\/|$)/i.test(url.pathname);
    if (forbiddenPath || !["http:", "https:"].includes(url.protocol)) unexpectedRequests.push(requestEvent.url());
  });

  await page.goto("/studio-v2/pi-00/");
  const qualification = await page.evaluate(async () => globalThis.__PI_00_QUALIFICATION_PROMISE__);
  expect(qualification.status).toBe("passed");
  expect(qualification.actualHarness).toBe(true);
  expect(qualification.actualMemorySessionRepo).toBe(true);
  expect(qualification.browser.nodeGlobalsAbsent).toBe(true);
  expect(qualification.toolCycle).toMatchObject({
    passed: true,
    memorySession: true,
    laneName: "tool-cycle",
    providerCalls: 2,
    toolEnds: 1
  });
  expect(qualification.toolCycle.result.value.status).toBe("completed");
  expect(qualification.abortCycle).toMatchObject({ passed: true, providerCalls: 1 });
  expect(qualification.abortCycle.abort.ok).toBe(true);
  expect(qualification.abortCycle.result.value.status).toBe("aborted");

  const bundleResponse = await request.get("/studio-v2/pi-00/qualification-entry.js");
  expect(bundleResponse.ok()).toBe(true);
  const bundle = await bundleResponse.text();
  expect(bundle.length).toBeGreaterThan(100_000);
  expect(bundle).not.toMatch(/\bfrom\s*["']node:/);
  expect(bundle).not.toMatch(/\bimport\s*\(\s*["']node:/);
  expect(bundle).not.toMatch(/\beval\s*\(/);
  expect(bundle).not.toContain("new Function");
  expect(bundle).not.toMatch(/from\s*["']@earendil-works\/pi-(?:agent-core|ai)/);

  const manifestResponse = await request.get("/studio-v2/pi-00/qualification-manifest.json");
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({
    id: "PI-00",
    sourceCommit: "b2602be77cb7b0de45dd616407fd210daa48aa75",
    entry: "qualification-entry.js",
    format: "es",
    static: true,
    appBackend: false,
    providerProxy: false
  });
  expect(manifest.bytes).toBe(Buffer.byteLength(bundle));
  expect(unexpectedRequests).toEqual([]);
});
