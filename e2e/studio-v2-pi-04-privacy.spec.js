import { expect, test } from "@playwright/test";

function realPrivacySse() {
  const args = JSON.stringify({ expectedRevision: 0, operations: [{
    type: "set_column_widths", tableSelector: ".scope-table-a-header, .scope-table-a-row",
    widths: ["12%", "43%", "11%", "16%", "18%"]
  }] });
  const event = { id: "pi04-real-privacy", object: "chat.completion.chunk", created: 1770000000, model: "pi04-real-privacy",
    choices: [{ index: 0, delta: { role: "assistant", tool_calls: [{ index: 0, id: "pi04-real-call", type: "function",
      function: { name: "printform_preview_changes", arguments: args } }] }, finish_reason: "tool_calls" }] };
  return `data: ${JSON.stringify(event)}\n\ndata: [DONE]\n\n`;
}

async function openQualification(page) {
  await page.goto("/studio-v2/pi-04/");
  return page.evaluate(() => globalThis.__PI_04_QUALIFICATION__);
}

test("17-09 keeps a Real-policy direct BYOK request memory-only and canary-free", async ({ page }) => {
  const requests = [];
  await page.route("https://provider.test/v1/chat/completions", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } });
      return;
    }
    requests.push({ body: route.request().postDataJSON(), headers: await route.request().allHeaders() });
    await route.fulfill({ status: 200, contentType: "text/event-stream", headers: { "access-control-allow-origin": "*" }, body: realPrivacySse() });
  });
  const runtime = await openQualification(page);
  const result = await page.evaluate(async () => globalThis.__PI_04_QUALIFICATION__.runCase("17-09"));
  expect(runtime).toMatchObject({ id: "PI-04", status: "ready", actualHarness: true, policyBound: true, frontendOnly: true });
  expect(result).toMatchObject({ caseId: "17-09", status: "passed", result: {
    provider: "openai-compatible-chat-real-privacy", policy: "real", persistentStorageAllowed: false,
    run: { ok: true }, proposalCount: 1, revision: 0, sessionMode: "memory", candidateRenderCount: 1,
    noCanaryInQualificationOutput: true, noProviderCredentialInQualificationOutput: true
  } });
  expect(result.result.calls).toEqual([{ surface: "agent", name: "preview_changes" }]);
  expect(requests).toHaveLength(1);
  expect(requests[0].headers.authorization).toContain("PI04-REAL-PRIVACY-SYNTHETIC-KEY");
  const body = JSON.stringify(requests[0].body);
  expect(body).not.toContain("PI04-REAL-PRIVACY-SYNTHETIC-KEY");
  expect(body).not.toContain("PI04-PRIVATE-CANARY-20260909");
});
