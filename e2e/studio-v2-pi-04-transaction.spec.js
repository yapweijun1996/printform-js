import { expect, test } from "@playwright/test";

function directPreviewSse() {
  const argumentsJson = JSON.stringify({ expectedRevision: 0, operations: [{
    type: "set_column_widths", tableSelector: ".scope-table-a-header, .scope-table-a-row",
    widths: ["12%", "43%", "11%", "16%", "18%"]
  }] });
  const event = { id: "pi04-commit-1", object: "chat.completion.chunk", created: 1770000000, model: "pi04-commit",
    choices: [{ index: 0, delta: { role: "assistant", tool_calls: [{ index: 0, id: "pi04-commit-call", type: "function",
      function: { name: "printform_preview_changes", arguments: argumentsJson } }] }, finish_reason: "tool_calls" }] };
  return `data: ${JSON.stringify(event)}\n\ndata: [DONE]\n\n`;
}

async function openQualification(page) {
  await page.goto("/studio-v2/pi-04/");
  return page.evaluate(() => {
    const qualification = globalThis.__PI_04_QUALIFICATION__;
    return { id: qualification.id, status: qualification.status, actualHarness: qualification.actualHarness,
      policyBound: qualification.policyBound, frontendOnly: qualification.frontendOnly, browser: qualification.browser };
  });
}

test("17-08 reconciles a lost direct-provider Apply response without a second revision", async ({ page }) => {
  const requests = [];
  await page.route("https://provider.test/v1/chat/completions", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fulfill({ status: 204, headers: {
        "access-control-allow-origin": "*", "access-control-allow-headers": "authorization,content-type"
      } });
      return;
    }
    requests.push({ body: route.request().postDataJSON(), headers: await route.request().allHeaders() });
    await route.fulfill({ status: 200, contentType: "text/event-stream", headers: { "access-control-allow-origin": "*" }, body: directPreviewSse() });
  });
  const runtime = await openQualification(page);
  const result = await page.evaluate(async () => globalThis.__PI_04_QUALIFICATION__.runCase("17-08"));
  expect(runtime).toMatchObject({ id: "PI-04", status: "ready", actualHarness: true, policyBound: true, frontendOnly: true });
  expect(result).toMatchObject({ caseId: "17-08", status: "passed", result: {
    provider: "openai-compatible-chat-commit-recovery", run: { ok: true }, applied: { ok: true, revision: 1, alreadyCommitted: true },
    lostResponse: true, proposalCount: 1, revision: 1, revisionEntries: [0, 1], sessionMode: "memory", candidateRenderCount: 1,
    noCanaryInQualificationOutput: true, noProviderCredentialInQualificationOutput: true
  } });
  expect(result.result.calls).toEqual(expect.arrayContaining([
    { surface: "agent", name: "preview_changes" }, { surface: "human", name: "approve_transaction" },
    { surface: "human", name: "apply_changes" }, { surface: "private", name: "get_transaction" },
    { surface: "private", name: "validate_project" }
  ]));
  expect(result.result.calls.filter(({ surface }) => surface === "agent").map(({ name }) => name)).toEqual(["preview_changes"]);
  expect(requests).toHaveLength(1);
  expect(requests[0].headers.authorization).toContain("PI04-COMMIT-SYNTHETIC-KEY");
  const body = JSON.stringify(requests[0].body);
  expect(body).not.toContain("PI04-COMMIT-SYNTHETIC-KEY");
  expect(body).not.toContain("PI04-PRIVATE-CANARY-20260909");
});
