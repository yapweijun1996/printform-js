import { expect, test } from "@playwright/test";
import { openEditor } from "./studio-v2-helpers.js";

test.describe("Studio v2 PROD-13 policy freshness", () => {
  test("rejects a delayed Provider result when the current policy disappears", async ({ page }) => {
    await page.goto("/studio-v2/");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await openEditor(page);

    const result = await page.evaluate(async () => {
      const { DesignerRuntimeController } = await import("/studio-v2/ui/agent-runtime.js");
      const { classifySyntheticDocument } = await import("/studio-v2/core/data-policy.js");
      const synthetic = classifySyntheticDocument("missing-current-policy");
      const policyState = { current: synthetic };
      let release;
      let markStarted;
      const started = new Promise((resolve) => { markStarted = resolve; });
      const session = {
        getState: () => ({ cumulativeUsage: { totalTokens: 0 } }),
        runStream() {
          return (async function* () {
            markStarted();
            await new Promise((resolve) => { release = resolve; });
            yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: "CANARY-MISSING-POLICY" } } } };
          }());
        }
      };
      const Agrun = {
        defineAction: (definition) => definition,
        createRuntime: () => ({ createSession: async () => session, openSession: async () => session, getAgentSkills: () => [] }),
        openaiBrowserSkill: {}, geminiBrowserSkill: {}
      };
      const profile = { id: "missing-current-policy", provider: "openai", model: "mock", apiKey: "memory-only" };
      const controller = await DesignerRuntimeController.create({
        Agrun, gateway: window.PrintFormStudioAgent, sessionManager: { createStore: () => ({}) },
        sessionId: crypto.randomUUID(), profile, dataPolicy: synthetic, getDataPolicy: () => policyState.current
      });
      const pending = controller.run("missing policy boundary check", profile);
      await started;
      policyState.current = null;
      release();
      return pending;
    });

    expect(result.errorReported).toBe(true);
    expect(result.completed).toMatchObject({ terminalKind: "error", error: { code: "STALE_POLICY_CONTEXT" } });
    expect(result.result).toBeNull();
    expect(JSON.stringify(result)).not.toContain("CANARY-MISSING-POLICY");
  });
});
