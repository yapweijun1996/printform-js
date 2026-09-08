import { expect, test } from "@playwright/test";
import { openInspector } from "./studio-v2-helpers.js";

test.describe("Studio v2 apply policy boundary", () => {
  test("does not retroactively auto-apply a delayed proposal after a mode change", async ({ page }) => {
    await page.goto("/studio-v2/");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await openInspector(page);
    await expect(page.locator("#ai-prompt")).toBeVisible();

    const result = await page.evaluate(async () => {
      const { createAgentPanelRuntime } = await import("/studio-v2/ui/agent-panel-runtime.js");
      const profile = { id: "browser-policy-profile", provider: "openai", model: "mock", apiKey: "memory-only" };

      async function runCase(initialMode, finalMode, proposalId) {
        const state = {
          applyMode: initialMode,
          proposal: null,
          controller: null,
          currentRecord: { id: `session-${proposalId}` },
          sessionNeedsCreate: false,
          log: document.querySelector("#ai-chat-log"),
          streamingNode: null,
          streamingText: "",
          usage: null
        };
        const statuses = [];
        let applied = 0;
        let release;
        let markStarted;
        const started = new Promise((resolve) => { markStarted = resolve; });
        const delayed = new Promise((resolve) => { release = resolve; });
        const renderProposal = (proposal) => { state.proposal = proposal; };
        state.controller = {
          async run() {
            markStarted();
            await delayed;
            renderProposal({ proposalId, diff: { changed: true } });
            return { completed: { terminalKind: "proposal_ready" } };
          },
          async applyProposal() {
            applied += 1;
            renderProposal(null);
            return { applied: { result: { revision: 1 } } };
          }
        };
        const runtime = createAgentPanelRuntime({
          state,
          vault: {},
          sessions: { touch: async () => {} },
          get: (selector) => document.querySelector(selector),
          getGateway: () => ({}),
          profile: () => profile,
          status: (key) => statuses.push(key),
          addMessage: () => {},
          renderProposal,
          renderSessions: () => {},
          onCandidateState: () => {},
          handleRuntimeEvent: () => {},
          openProviderSettings: () => {}
        });
        document.querySelector("#ai-prompt").value = `controlled ${proposalId}`;
        const pending = runtime.send();
        await started;
        state.applyMode = finalMode;
        release();
        await pending;
        return { applied, proposalPending: Boolean(state.proposal), statuses };
      }

      return {
        previewToAuto: await runCase("preview", "auto", "preview-to-auto"),
        autoToPreview: await runCase("auto", "preview", "auto-to-preview")
      };
    });

    expect(result.previewToAuto.applied).toBe(0);
    expect(result.previewToAuto.proposalPending).toBe(true);
    expect(result.autoToPreview.applied).toBe(0);
    expect(result.autoToPreview.proposalPending).toBe(true);
  });
});
