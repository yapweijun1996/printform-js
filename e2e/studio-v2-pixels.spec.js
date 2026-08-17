import { expect, test } from "@playwright/test";
import { openEditor } from "./studio-v2-helpers.js";

test.describe("synthetic pixel evidence boundary", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Sandbox pixel rasterization is validated in Chromium; geometry evidence covers other engines.");

  test("captures synthetic pixels and rejects pixel evidence in real-data mode", async ({ page }) => {
    await page.goto("/studio-v2/");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await openEditor(page);
    const result = await page.evaluate(async () => {
      const summary = await window.PrintFormStudioAgent.execute("get_project_summary");
      return window.PrintFormStudioAgent.execute("capture_layout_evidence", {
        expectedRevision: summary.result.revision, scenario: "default", visualMode: "pixels"
      });
    });
    expect(result.ok).toBe(true);
    expect(result.result.evidence).toMatchObject({ visualMode: "pixels", pixelSnapshotHash: expect.any(String) });
    expect(result.result.evidence.pixelSnapshot).toMatchObject({ source: "sandbox-pixel", syntheticData: true, redacted: false });
    expect(result.result.evidence.pixelSnapshot.dataUrl).toMatch(/^data:image\/(png|jpeg|webp);base64,/);

    await page.locator("#real-data-mode").check();
    const blocked = await page.evaluate(() => window.PrintFormStudioAgent.execute("capture_layout_evidence", {
      expectedRevision: 0, scenario: "default", visualMode: "pixels"
    }));
    expect(blocked).toMatchObject({ ok: false, error: { code: "PIXEL_EVIDENCE_SYNTHETIC_ONLY" } });
  });

  test("runs a real pixel review, approval-bound repair, fresh re-review and readiness check", async ({ page }) => {
    await page.goto("/studio-v2/");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    const result = await page.evaluate(async () => {
      const { DesignerRuntimeController } = await import("/studio-v2/ui/agent-runtime.js");
      let runtimeOptions;
      let turn = 0;
      const images = [];
      const session = {
        getState: () => ({ cumulativeUsage: { totalTokens: 0 } }),
        runStream(input) {
          turn += 1;
          images.push((input.parts || []).map((part) => part.url.slice(0, 30)));
          return (async function* () {
            const actions = new Map(runtimeOptions.customActions.map((action) => [action.name, action]));
            if (turn === 1) {
              await actions.get("printform_preview_layout_repair").execute({}, {
                operations: [{ type: "set_brand_color", hex: "#854d0e" }],
                findings: [{ code: "HIERARCHY", severity: "major", status: "open", message: "Strengthen visual hierarchy" }],
                summary: "Use an accessible dark amber brand color"
              });
            } else {
              await actions.get("printform_complete_current_layout_review").execute({}, {
                findings: [],
                summary: "Fresh pixel evidence verifies the repair"
              });
            }
            yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: "done" } } } };
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
      const events = [];
      const profile = { id: "pixel-loop", provider: "openai", model: "mock-vision", apiKey: "memory-only" };
      const controller = await DesignerRuntimeController.create({
        Agrun, gateway: window.PrintFormStudioAgent, sessionManager: { createStore: () => ({}) },
        sessionId: crypto.randomUUID(), profile, onEvent: (event) => events.push(event.type)
      });
      const first = await controller.reviewLayout(profile);
      const proposalId = controller.pendingProposal?.proposalId;
      const final = await controller.applyApprovedProposal(proposalId, profile);
      const summary = await window.PrintFormStudioAgent.execute("get_project_summary");
      return {
        firstTerminal: first.completed.terminalKind,
        proposalId,
        revision: summary.result.revision,
        ready: final.review.readiness.result.ready,
        turns: turn,
        images,
        events
      };
    });
    expect(result).toMatchObject({ firstTerminal: "proposal_ready", revision: 1, ready: true, turns: 2 });
    expect(result.proposalId).toBeTruthy();
    expect(result.images).toHaveLength(2);
    expect(result.images.flat().every((prefix) => prefix.startsWith("data:image/"))).toBe(true);
    expect(result.events).toEqual(expect.arrayContaining([
      "layout_repair_proposed", "layout_repair_applied", "layout_review_passed", "layout_readiness"
    ]));
  });
});
