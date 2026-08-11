import { describe, expect, it } from "vitest";
import { CommandBus } from "../../studio-v2/core/command-bus.js";
import { executeAgentCommand } from "../../studio-v2/adapters/gateway.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";
import { hashRenderProject } from "../../studio-v2/core/render-provenance.js";
import { createRedactedLayoutSnapshot } from "../../studio-v2/ui/layout-snapshot.js";
import { DesignerRuntimeController } from "../../studio-v2/ui/agent-runtime.js";

const profile = { id: "test-profile", provider: "openai", model: "gpt-test", apiKey: "memory-only" };

function readyReport(overrides = {}) {
  const report = {
    status: "ready",
    validation: { valid: true, productionValid: true, errors: [], warnings: [] },
    metrics: { logicalPages: 1, overflowElements: 0, verticalOverflowPages: 0, contrastFailures: 0 },
    pageGeometry: [{ width: 794, height: 1123, children: [{ x: 0, y: 0, width: 794, height: 160 }] }],
    issues: [],
    pixelSnapshot: { source: "sandbox-pixel", syntheticData: true, redacted: false, mimeType: "image/png", dataUrl: "data:image/png;base64,AAAA", width: 794, height: 1123, pageCount: 1 },
    ...overrides
  };
  return { ...report, safeSnapshot: createRedactedLayoutSnapshot(report) };
}

function fakeAgrun(runTurn) {
  let runtimeOptions;
  let turns = 0;
  const inputs = [];
  const session = {
    getState: () => ({ cumulativeUsage: { totalTokens: 0 } }),
    runStream(input) {
      turns += 1;
      inputs.push(input);
      return (async function* () {
        const actions = new Map(runtimeOptions.customActions.map((item) => [item.name, item]));
        await runTurn({ turn: turns, actions, input });
        yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: "review decision complete" } } } };
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
  return { Agrun, inputs, turns: () => turns, options: () => runtimeOptions };
}

async function harness(runTurn, renderer = async () => readyReport()) {
  const bus = new CommandBus(createSalesInvoiceProject(), { renderCandidate: renderer });
  const initial = readyReport();
  const projectHash = await hashRenderProject(bus.project);
  bus.recordRenderReport(initial, { revision: 0, candidateHash: projectHash, baseProjectHash: projectHash, source: "committed" });
  const gatewayCalls = [];
  const gateway = { execute: async (name, input = {}) => {
    const response = await executeAgentCommand(bus, name, input);
    gatewayCalls.push({ name, input, response });
    return response;
  } };
  const fake = fakeAgrun(runTurn);
  const events = [];
  const candidateStates = [];
  const controller = await DesignerRuntimeController.create({
    Agrun: fake.Agrun, gateway, sessionManager: { createStore: () => ({}) }, sessionId: "review-loop", profile,
    onProposal: () => {}, onCandidateState: (active) => candidateStates.push(active), onEvent: (event) => events.push(event)
  });
  return { bus, controller, events, candidateStates, fake, gatewayCalls };
}

describe("embedded AI multimodal layout review loop", () => {
  it("captures multimodal evidence, completes host-bound review, and reports readiness", async () => {
    const test = await harness(async ({ actions, input }) => {
      expect(input.parts).toHaveLength(2);
      expect(actions.has("printform_request_export")).toBe(false);
      await actions.get("printform_complete_current_layout_review").execute({}, { findings: [], summary: "All pages are visually sound" });
    });

    const outcome = await test.controller.reviewLayout(profile);
    const captures = test.gatewayCalls.filter((item) => item.name === "capture_layout_evidence");
    expect(captures).toHaveLength(2);
    expect(captures.every((item) => item.response.result.evidence.visualMode === "pixels")).toBe(true);
    expect(outcome.readiness.result).toMatchObject({ ready: true, requiresUserConfirmation: true });
    expect(test.events.map((event) => event.type)).toEqual(expect.arrayContaining([
      "layout_review_started", "layout_evidence_ready", "layout_multimodal_started", "layout_review_passed", "layout_readiness"
    ]));
    expect(test.bus.revision).toBe(0);
  });

  it("previews one visual repair, waits for approval, applies once, and automatically re-reviews fresh evidence", async () => {
    const test = await harness(async ({ turn, actions, input }) => {
      expect(input.parts).toHaveLength(2);
      if (turn === 1) {
        await actions.get("printform_preview_layout_repair").execute({}, {
          operations: [{ type: "set_brand_color", hex: "#854d0e" }],
          findings: [{ code: "WEAK_HIERARCHY", severity: "major", status: "open", message: "Brand hierarchy needs stronger contrast" }],
          summary: "Strengthen the visual hierarchy"
        });
      } else {
        await actions.get("printform_complete_current_layout_review").execute({}, {
          findings: [],
          summary: "Repair verified with fresh evidence"
        });
      }
    });

    const first = await test.controller.reviewLayout(profile);
    expect(first.completed.terminalKind).toBe("proposal_ready");
    expect(test.bus.revision).toBe(0);
    expect(test.controller.pendingProposal.review).toMatchObject({ pass: 1, findings: [expect.objectContaining({ code: "WEAK_HIERARCHY" })] });

    const applied = await test.controller.applyApprovedProposal(test.controller.pendingProposal.proposalId, profile);
    expect(applied.review.readiness.result).toMatchObject({ ready: true });
    expect(test.bus.revision).toBe(1);
    expect(test.fake.turns()).toBe(2);
    expect(test.gatewayCalls.filter((item) => item.name === "capture_layout_evidence")).toHaveLength(4);
    expect(test.events.map((event) => event.type)).toEqual(expect.arrayContaining([
      "layout_repair_proposed", "proposal_ready", "proposal_applied", "layout_repair_applied", "layout_review_passed"
    ]));
    expect(test.candidateStates).toEqual([true, false]);
  });

  it("sends unsigned safe observations for broken scenarios and can terminate blocked without a receipt", async () => {
    const broken = readyReport({
      status: "invalid",
      validation: { valid: false, productionValid: false, errors: [{ code: "VERTICAL_OVERFLOW" }], warnings: [] },
      metrics: { logicalPages: 1, overflowElements: 1, verticalOverflowPages: 1, contrastFailures: 0 },
      issues: [{ code: "VERTICAL_OVERFLOW", pageIndex: 0, rect: { x: 10, y: 1000, width: 774, height: 180 } }]
    });
    const test = await harness(async ({ actions, input }) => {
      expect(input.parts).toHaveLength(2);
      await actions.get("printform_report_layout_blocked").execute({}, {
        findings: [{ code: "VERTICAL_OVERFLOW", severity: "major", status: "open", message: "Content exceeds the printable page" }],
        summary: "No safe automatic repair was selected"
      });
    }, async () => broken);

    const outcome = await test.controller.reviewLayout(profile);
    const captures = test.gatewayCalls.filter((item) => item.name === "capture_layout_evidence");
    expect(captures.every((item) => item.response.result.evidence === null)).toBe(true);
    expect(captures.every((item) => item.response.result.observation.pixelSnapshot.dataUrl.startsWith("data:image/png"))).toBe(true);
    expect(outcome.blocked.findings[0]).toMatchObject({ code: "VERTICAL_OVERFLOW", severity: "major" });
    expect(outcome.readiness).toBeNull();
    expect(test.gatewayCalls.map((item) => item.name)).not.toContain("complete_layout_review");
  });

  it("prevents a third repair proposal after two approved repair passes", async () => {
    const test = await harness(async ({ turn, actions }) => {
      const operations = turn === 1 ? [{ type: "set_brand_color", hex: "#854d0e" }] : [{ type: "set_font_scale", basePt: 9.5 }];
      await actions.get("printform_preview_layout_repair").execute({}, {
        operations,
        findings: [{ code: `PASS_${turn}_ISSUE`, severity: "major", status: "open", message: "A repair remains necessary" }],
        summary: `Repair pass ${turn}`
      });
    });

    await test.controller.reviewLayout(profile);
    const firstApply = await test.controller.applyApprovedProposal(test.controller.pendingProposal.proposalId, profile);
    expect(firstApply.review.completed.terminalKind).toBe("proposal_ready");
    const secondApply = await test.controller.applyApprovedProposal(test.controller.pendingProposal.proposalId, profile);
    expect(secondApply.review.completed).toMatchObject({ terminalKind: "error", error: { code: "AUTO_REPAIR_LIMIT_REACHED" } });
    expect(test.bus.revision).toBe(2);
    expect(test.fake.turns()).toBe(3);
  });
});
