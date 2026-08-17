import { describe, expect, it } from "vitest";
import { CommandBus } from "../../studio-v2/core/command-bus.js";
import { executeAgentCommand } from "../../studio-v2/adapters/gateway.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";
import { createProposalApproval } from "../../studio-v2/ui/agent-approval.js";
import { DesignerRuntimeController } from "../../studio-v2/ui/agent-runtime.js";

const profile = { id: "workflow-test", provider: "openai", model: "gpt-test", apiKey: "memory-only" };

function fakeAgrun(runAction, finalText = "done", streamHook = null, finalOutput = null) {
  let options;
  let runCount = 0;
  const session = {
    getState: () => ({ cumulativeUsage: { totalTokens: 0 } }),
    runStream(input, runOptions = {}) {
      runCount += 1;
      return (async function* () {
        const actions = new Map(options.customActions.map((action) => [action.name, action]));
        if (runAction) await runAction(actions, input);
        if (streamHook) await streamHook({ actions, input, runOptions });
        yield { type: "phase", detail: { phase: "act", transition: "completed", info: { actionName: "printform_preview_changes", outcome: "executed" } } };
          yield { type: "completed", detail: { terminalKind: "done", result: { output: finalOutput || { text: finalText } } } };
      }());
    }
  };
  const Agrun = {
    defineAction: (definition) => definition,
    createRuntime: (runtimeOptions) => {
      options = runtimeOptions;
      return { createSession: async () => session, openSession: async () => session, getAgentSkills: () => [] };
    },
    openaiBrowserSkill: {},
    geminiBrowserSkill: {}
  };
  return { Agrun, options: () => options, runCount: () => runCount };
}

function commandGateway(bus, calls = []) {
  return {
    async execute(name, input = {}) {
      const response = await executeAgentCommand(bus, name, input);
      calls.push({ name, input, response });
      return response;
    }
  };
}

describe("AI Designer deterministic proposal workflow", () => {
  it("stops after a yellow preview, then applies exactly once without a second model turn", async () => {
    const report = { status: "ready", validation: { errors: [], warnings: [] }, issues: [], metrics: {} };
    const bus = new CommandBus(createSalesInvoiceProject(), { renderCandidate: async () => report });
    const calls = [];
    let actionResult;
    const fake = fakeAgrun(async (actions) => {
      actionResult = await actions.get("printform_preview_brand_color").execute({}, { hex: "#854d0e" });
    });
    const proposals = [];
    const events = [];
    const controller = await DesignerRuntimeController.create({
      Agrun: fake.Agrun,
      gateway: commandGateway(bus, calls),
      sessionManager: { createStore: () => ({}) },
      sessionId: "yellow-workflow",
      profile,
      onProposal: (proposal) => proposals.push(proposal),
      onEvent: (event) => events.push(event)
    });

    const outcome = await controller.run("Create a new yellow color style PrintForm", profile);
    expect(outcome.completed.terminalKind).toBe("proposal_ready");
    expect(bus.revision).toBe(0);
    expect(controller.pendingProposal.operations).toEqual([{ type: "set_brand_color", hex: "#854d0e" }]);
    expect(JSON.stringify(proposals[0])).not.toContain("approvalToken");
    expect(events.map((event) => event.type)).toContain("proposal_ready");
    expect(actionResult.control).toBe("complete");

    const result = await controller.applyApprovedProposal(controller.pendingProposal.proposalId, profile);
    expect(result.validation.ok).toBe(true);
    expect(bus.revision).toBe(1);
    expect(bus.project.themeCss).toContain("#854d0e");
    expect(fake.runCount()).toBe(1);
    expect(calls.map((call) => call.name)).toEqual(["get_project_summary", "preview_changes", "approve_transaction", "apply_changes", "validate_project"]);
    await expect(controller.applyApprovedProposal(proposals[0].proposalId, profile)).rejects.toMatchObject({ code: "PROPOSAL_NOT_FOUND" });
  });

  it("turns a gateway preview failure into a terminal runtime error without a proposal", async () => {
    const fake = fakeAgrun(async (actions) => {
      await actions.get("printform_preview_changes").execute({}, { expectedRevision: 9, operations: [{ type: "set_brand_color", hex: "#854d0e" }] });
    });
    const events = [];
    const controller = await DesignerRuntimeController.create({
      Agrun: fake.Agrun,
      gateway: { execute: async () => ({ ok: false, error: { code: "STALE_REVISION", message: "secret value" } }) },
      sessionManager: { createStore: () => ({}) },
      sessionId: "failed-preview",
      profile,
      onEvent: (event) => events.push(event)
    });
    const outcome = await controller.run("yellow", profile);
    expect(outcome.completed.terminalKind).toBe("error");
    expect(outcome.completed.error).toMatchObject({ code: "STALE_REVISION" });
    expect(controller.pendingProposal).toBeNull();
    expect(events.find((event) => event.type === "runtime_error")).toMatchObject({ detail: { code: "STALE_REVISION" } });
    expect(JSON.stringify(events)).not.toContain("secret value");
  });

  it("publishes the safe discriminated operation schemas and no model apply action", async () => {
    const fake = fakeAgrun(async () => {});
    await DesignerRuntimeController.create({
      Agrun: fake.Agrun,
      gateway: { execute: async () => ({ ok: true, result: {} }) },
      sessionManager: { createStore: () => ({}) },
      sessionId: "schema-workflow",
      profile
    });
    const actions = fake.options().customActions;
    const preview = actions.find((action) => action.name === "printform_preview_changes");
    const schemas = preview.planner.argsSchema.operations.items.oneOf;
    expect(schemas).toHaveLength(7);
    expect(new Set(schemas.map((schema) => schema.properties.type.const)).size).toBe(7);
    expect(actions.map((action) => action.name)).not.toContain("printform_apply_approved_proposal");
    const brandPreview = actions.find((action) => action.name === "printform_preview_brand_color");
    expect(brandPreview.outputSchema.controls).toEqual(["complete"]);
    expect(fake.options()).toMatchObject({ plannerMode: "native_tools", nativeToolsFailurePolicy: "hard_fail" });
  });

  it("stops a plain provider final before it can pretend a design action happened", async () => {
    const bus = new CommandBus(createSalesInvoiceProject());
    const events = [];
    const fake = fakeAgrun(null, "I changed the purchase order styling.", async ({ runOptions }) => {
      runOptions.onToken?.("I changed the purchase order styling.");
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await runOptions.onBeforeFinalize?.({}, { source: "planner_final" });
      }
    });
    const controller = await DesignerRuntimeController.create({
      Agrun: fake.Agrun, gateway: commandGateway(bus), sessionManager: { createStore: () => ({}) },
      sessionId: "terminal-action-required", profile, onEvent: (event) => events.push(event)
    });

    const outcome = await controller.run("make this purchase order red", profile);
    expect(outcome.completed).toMatchObject({ terminalKind: "error", error: { code: "TERMINAL_ACTION_REQUIRED" } });
    expect(outcome.errorReported).toBe(true);
    expect(events).toContainEqual(expect.objectContaining({
      type: "terminal_action_required",
      detail: expect.objectContaining({ source: "planner_final", attempt: 3, maxAttempts: 3, status: "blocked" })
    }));
    expect(controller.pendingProposal).toBeNull();
    expect(bus.revision).toBe(0);
  });

  it("repairs safe invalid planner JSON into the real preview action", async () => {
    const bus = new CommandBus(createSalesInvoiceProject());
    const calls = [];
    const fake = fakeAgrun(null, "done", async ({ actions, runOptions }) => {
      const decision = await runOptions.onInvalidPlannerOutput?.('{"type":"set_brand_color","hex":"#854d0e"}');
      expect(decision).toMatchObject({ type: "action", name: "printform_preview_changes" });
      await actions.get(decision.name).execute({}, decision.args);
    });
    const controller = await DesignerRuntimeController.create({
      Agrun: fake.Agrun, gateway: commandGateway(bus, calls), sessionManager: { createStore: () => ({}) },
      sessionId: "invalid-planner-repair", profile
    });

    const outcome = await controller.run("make the heading amber", profile);
    expect(outcome.completed.terminalKind).toBe("proposal_ready");
    expect(controller.pendingProposal.operations).toEqual([{ type: "set_brand_color", hex: "#854d0e" }]);
    expect(calls.map((call) => call.name)).toEqual(["get_project_summary", "preview_changes"]);
    expect(bus.revision).toBe(0);
  });

  it("recovers a provider's plain-text semantic proposal through the real preview path", async () => {
    const bus = new CommandBus(createSalesInvoiceProject());
    const calls = [];
    const fake = fakeAgrun(null, 'Semantic proposal: {"type":"set_brand_color","hex":"#854d0e"}');
    const events = [];
    const controller = await DesignerRuntimeController.create({
      Agrun: fake.Agrun, gateway: commandGateway(bus, calls), sessionManager: { createStore: () => ({}) },
      sessionId: "text-proposal", profile, onEvent: (event) => events.push(event)
    });

    const outcome = await controller.run("make yellow", profile);
    expect(outcome.completed.terminalKind).toBe("proposal_ready");
    expect(controller.pendingProposal.operations).toEqual([{ type: "set_brand_color", hex: "#854d0e" }]);
    expect(calls.map((call) => call.name)).toEqual(["get_project_summary", "preview_changes"]);
    expect(outcome.result.output.text).toContain("set_brand_color");
    expect(events).toContainEqual({ type: "proposal_recovered", detail: { status: "success", operationCount: 1 } });

    await controller.applyApprovedProposal(controller.pendingProposal.proposalId, profile);
    expect(bus.revision).toBe(1);
    expect(bus.project.themeCss).toContain("#854d0e");
  });

  it("does not auto-recover a high-risk raw replacement from plain text", async () => {
    const bus = new CommandBus(createSalesInvoiceProject());
    const calls = [];
    const fake = fakeAgrun(null, 'Proposal: {"type":"replace_template","value":"<div>unsafe</div>"}');
    const controller = await DesignerRuntimeController.create({
      Agrun: fake.Agrun, gateway: commandGateway(bus, calls), sessionManager: { createStore: () => ({}) },
      sessionId: "text-raw-proposal", profile
    });

    const outcome = await controller.run("replace the raw template", profile);
    expect(outcome.completed.terminalKind).toBe("done");
    expect(controller.pendingProposal).toBeNull();
    expect(calls).toHaveLength(0);
    expect(bus.revision).toBe(0);
  });

  it("pauses a native approval as a terminal state and blocks a second prompt", async () => {
    const fake = fakeAgrun(null, "done", null, {
      resumeToken: { tokenId: "resume-1", actionName: "printform_apply_approved_proposal" },
      actionName: "printform_apply_approved_proposal"
    });
    const controller = await DesignerRuntimeController.create({
      Agrun: fake.Agrun, gateway: { execute: async () => ({ ok: true, result: {} }) },
      sessionManager: { createStore: () => ({}) }, sessionId: "pending-approval", profile
    });

    const outcome = await controller.run("apply the approved design", profile);
    expect(outcome.completed).toMatchObject({ terminalKind: "pending_approval" });
    expect(controller.pendingApproval).toMatchObject({ actionName: "printform_apply_approved_proposal" });
    await expect(controller.run("start another design", profile)).rejects.toMatchObject({ code: "PENDING_APPROVAL" });
  });

  it("normalizes a stringified operation emitted by a provider planner", async () => {
    const bus = new CommandBus(createSalesInvoiceProject());
    const fake = fakeAgrun(async (actions) => {
      await actions.get("printform_preview_changes").execute({}, {
        expectedRevision: 0,
        operations: [JSON.stringify({ type: "set_brand_color", hex: "#854d0e" })]
      });
    });
    const controller = await DesignerRuntimeController.create({
      Agrun: fake.Agrun, gateway: commandGateway(bus), sessionManager: { createStore: () => ({}) },
      sessionId: "string-operation", profile
    });
    const outcome = await controller.run("yellow", profile);
    expect(outcome.completed.terminalKind).toBe("proposal_ready");
    expect(controller.pendingProposal.operations).toEqual([{ type: "set_brand_color", hex: "#854d0e" }]);
  });
});

describe("proposal approval token", () => {
  it("is session-bound, expires, and can be used only once", async () => {
    let time = 1000;
    const approval = createProposalApproval({ sessionId: "session-a", ttlMs: 100, now: () => time });
    const token = await approval.issue("proposal-a");
    await expect(approval.verify(token, "proposal-b")).rejects.toMatchObject({ code: "APPROVAL_TOKEN_INVALID" });
    await expect(approval.verify(token, "proposal-a")).resolves.toMatchObject({ sessionId: "session-a", proposalId: "proposal-a" });
    await expect(approval.verify(token, "proposal-a")).rejects.toMatchObject({ code: "APPROVAL_TOKEN_USED" });

    const expiring = createProposalApproval({ sessionId: "session-b", ttlMs: 100, now: () => time });
    const expiredToken = await expiring.issue("proposal-b");
    time = 1200;
    await expect(expiring.verify(expiredToken, "proposal-b")).rejects.toMatchObject({ code: "APPROVAL_TOKEN_EXPIRED" });
  });
});
