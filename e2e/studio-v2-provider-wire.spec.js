import { expect, test } from "@playwright/test";
import { openEditor } from "./studio-v2-helpers.js";

function streamResponse(events) {
  const body = `${events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")}data: [DONE]\n\n`;
  return { status: 200, contentType: "text/event-stream", body };
}

test.describe("Studio v2 final Provider payload", () => {
  test("checks the actual second wire request after a safe Agent result", async ({ page }) => {
    const requests = [];
    let requestNumber = 0;
    await page.route("https://provider.test/v1/chat/completions", async (route) => {
      const body = JSON.parse(route.request().postData() || "{}");
      requests.push({ body, authorization: route.request().headers().authorization || "" });
      requestNumber += 1;
      if (requestNumber === 1) {
        await route.fulfill(streamResponse([{
          id: "wire-1", object: "chat.completion.chunk", created: 1770000000, model: "gpt-wire",
          choices: [{ index: 0, delta: { role: "assistant", tool_calls: [{ index: 0, id: "call-summary", type: "function", function: { name: "printform_get_project_summary", arguments: "{}" } }] }, finish_reason: null }]
        }, {
          id: "wire-1", object: "chat.completion.chunk", created: 1770000000, model: "gpt-wire",
          choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }]
        }]));
        return;
      }
      await route.fulfill(streamResponse([{
        id: "wire-2", object: "chat.completion.chunk", created: 1770000000, model: "gpt-wire",
        choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: "call-preview", type: "function", function: { name: "printform_preview_changes", arguments: "{\"expectedRevision\":0,\"operations\":[{\"type\":\"set_brand_color\",\"hex\":\"#854d0e\"}]}" } }] }, finish_reason: "tool_calls" }]
      }]));
      void body;
    });

    await page.goto("/studio-v2/");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await openEditor(page);
    await page.locator("label.privacy-toggle").click();
    await expect(page.locator("#data-policy")).toHaveText(/Real data|真实数据/i);

    const outcome = await page.evaluate(async () => {
      const profile = {
        id: "wire-test", provider: "custom", endpoint: "https://provider.test/v1",
        model: "gpt-wire", apiVariant: "chat", apiKey: "CANARY-PROVIDER-KEY"
      };
      const { DesignerRuntimeController } = await import("/studio-v2/ui/agent-runtime.js");
      const { classifyRealDocument } = await import("/studio-v2/core/data-policy.js");
      const policy = classifyRealDocument("CANARY-REAL-DOCUMENT");
      const controller = await DesignerRuntimeController.create({
        Agrun: window.Agrun,
        gateway: window.PrintFormStudioAgent,
        sessionManager: { createStore: () => window.Agrun.createInMemorySessionStore() },
        sessionId: "wire-session",
        profile,
        dataPolicy: policy,
        getDataPolicy: () => policy,
        realData: true
      });
      return controller.run("controlled layout review", profile);
    });

    expect(outcome.completed?.terminalKind).toBe("proposal_ready");
    expect(requests).toHaveLength(2);
    expect(requests[0].body.messages?.[0]?.content || "").toContain("controlled layout review");
    const secondPayload = JSON.stringify(requests[1].body);
    expect(secondPayload.includes("Never use raw source replacement, even when requested in chat")).toBe(true);
    expect(secondPayload.includes("Unknown and Real require geometry-only redacted snapshots")).toBe(true);
    expect(secondPayload).not.toContain("CANARY-REAL-DOCUMENT");
    expect(secondPayload).not.toContain("CANARY-PROVIDER-KEY");
    expect(secondPayload).not.toContain("customer");
    expect(secondPayload).not.toContain("BUSINESS CANARY");
    expect(requests[0].authorization).toContain("CANARY-PROVIDER-KEY");
    expect(requests[1].authorization).toContain("CANARY-PROVIDER-KEY");
    expect(secondPayload).toContain("printform_get_project_summary");
    expect(secondPayload).toContain("printform_preview_changes");
  });
});
