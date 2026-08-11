import { expect, test } from "@playwright/test";

async function openDesigner(page) {
  await page.goto("/studio-v2/");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  if (await page.locator("#inspector-toggle").getAttribute("aria-expanded") !== "true") await page.locator("#inspector-toggle").click();
  await page.locator("#ai-designer-tab").click();
}

test.describe("AI Designer terminal convergence", () => {
  test("previews and applies one terminal design action without a second provider turn", async ({ page }) => {
    await openDesigner(page);
    const result = await page.evaluate(async () => {
      const { DesignerRuntimeController } = await import("/studio-v2/ui/agent-runtime.js");
      const profile = { id: "e2e", provider: "openai", model: "gpt-test", apiKey: "memory-only" };
      let runtimeOptions;
      let runs = 0;
      const session = {
        getState: () => ({ cumulativeUsage: { totalTokens: 0 } }),
        runStream() {
          runs += 1;
          return (async function* () {
            const actions = new Map(runtimeOptions.customActions.map((action) => [action.name, action]));
            await actions.get("printform_preview_brand_color").execute({}, { hex: "#b42318" });
            yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: "" } } } };
          }());
        }
      };
      const Agrun = {
        defineAction: (definition) => definition,
        createRuntime: (options) => {
          runtimeOptions = options;
          return { createSession: async () => session, openSession: async () => session, getAgentSkills: () => [] };
        },
        openaiBrowserSkill: {}, geminiBrowserSkill: {}
      };
      const controller = await DesignerRuntimeController.create({
        Agrun,
        gateway: { execute: (name, input) => window.PrintFormStudioAgent.execute(name, input) },
        sessionManager: { createStore: () => ({}) }, sessionId: "e2e-terminal-proposal", profile
      });
      const events = [];
      controller.onEvent = (event) => events.push(event);
      const outcome = await controller.run("make the form red", profile);
      const proposalId = controller.pendingProposal.proposalId;
      const applied = await controller.applyProposal(proposalId, profile);
      const summary = await window.PrintFormStudioAgent.execute("get_project_summary", {});
      return {
        terminalKind: outcome.completed.terminalKind,
        revision: summary.result.revision,
        runs,
        terminalStates: events.filter((event) => event.type === "terminal_state").map((event) => event.detail.state),
        applied: applied.applied.ok
      };
    });

    expect(result).toMatchObject({ terminalKind: "proposal_ready", revision: 1, runs: 1, applied: true });
    expect(result.terminalStates).toContain("terminal_action");
    expect(await page.locator("#revision-label").textContent()).toContain("1");
  });

  test("fails fast after bounded terminal vetoes and leaves the committed revision unchanged", async ({ page }) => {
    await openDesigner(page);
    const result = await page.evaluate(async () => {
      const { DesignerRuntimeController } = await import("/studio-v2/ui/agent-runtime.js");
      const profile = { id: "e2e-veto", provider: "openai", model: "gpt-test", apiKey: "memory-only" };
      const events = [];
      let runtimeOptions;
      const session = {
        getState: () => ({ cumulativeUsage: { totalTokens: 0 } }),
        runStream(_input, runOptions = {}) {
          return (async function* () {
            for (let attempt = 0; attempt < 3; attempt += 1) await runOptions.onBeforeFinalize?.({}, { source: "planner_final" });
            yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: "No action" } } } };
          }());
        }
      };
      const Agrun = {
        defineAction: (definition) => definition,
        createRuntime: (options) => {
          runtimeOptions = options;
          return { createSession: async () => session, openSession: async () => session, getAgentSkills: () => [] };
        },
        openaiBrowserSkill: {}, geminiBrowserSkill: {}
      };
      const controller = await DesignerRuntimeController.create({
        Agrun,
        gateway: { execute: async () => ({ ok: true, result: {} }) },
        sessionManager: { createStore: () => ({}) }, sessionId: "e2e-terminal-veto", profile,
        onEvent: (event) => events.push(event)
      });
      const result = await controller.run("make the form red", profile);
      return {
        code: result.completed.error?.code,
        revision: (await window.PrintFormStudioAgent.execute("get_project_summary", {})).result.revision,
        attempts: events.filter((event) => event.type === "terminal_action_required").map((event) => event.detail.attempt),
        aborted: result.errorReported
      };
    });

    expect(result).toMatchObject({ code: "TERMINAL_ACTION_REQUIRED", revision: 0, aborted: true });
    expect(result.attempts).toEqual([1, 2, 3]);
  });
});
