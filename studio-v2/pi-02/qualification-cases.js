import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import { createPi02Harness, createQualificationEnvironment, prepareReview } from "./qualification-env.js";

const COLOR_OPERATION = { type: "set_brand_color", hex: "#854d0e" };

function errorCode(error) { return error?.code || "QUALIFICATION_FAILED"; }

function finish({ harness, faux, env, tools = [], extra = {} }) {
  return {
    ...extra,
    run: harness.hostRun,
    proposals: harness.proposals,
    state: harness.state,
    events: harness.events,
    calls: env.calls(),
    providerCalls: faux.state.callCount,
    rawEvents: harness.rawTypes,
    tools: tools.map((tool) => tool.name)
  };
}

async function previewCase() {
  const qualification = await createPi02Harness({
    responses: [fauxAssistantMessage([fauxToolCall("printform_preview_changes", { expectedRevision: 0, operations: [COLOR_OPERATION] }, { id: "preview-1" })], { stopReason: "toolUse" })]
  });
  try {
    const hostRun = await qualification.host.run("Preview the brand colour change.");
    return finish({ harness: { hostRun, proposals: qualification.host.proposals(), state: qualification.host.state(), events: qualification.host.events(), rawTypes: qualification.host.rawTypes() }, tools: qualification.host.tools, ...qualification });
  } finally { await qualification.host.dispose(); }
}

async function reviewCase() {
  const env = await createQualificationEnvironment();
  const review = await prepareReview(env);
  const response = [fauxAssistantMessage([fauxToolCall("printform_complete_current_layout_review", { findings: [], summary: "All required scenarios are sound." }, { id: "review-1" })], { stopReason: "toolUse" })];
  const qualification = await createPi02Harness({ environment: env, responses: response, reviewHooks: {
    completeInput: (args) => ({ ...args, expectedRevision: env.bus.revision, reviewer: "ai-agent", evidenceIds: review.evidenceIds }),
    markComplete: () => {}
  } });
  try {
    const hostRun = await qualification.host.run("Complete the current layout review.");
    return {
      run: hostRun, proposals: qualification.host.proposals(), state: qualification.host.state(), events: qualification.host.events(),
      calls: env.calls(), providerCalls: qualification.faux.state.callCount, rawEvents: qualification.host.rawTypes(),
      reviewSetup: { attempt: review.started.result.attempt, scenarios: review.captured.map((item) => item.scenario) },
      reviewStatus: env.bus.reviewReceipt ? "pass" : "not_passed"
    };
  } finally {
    await qualification.host.dispose();
  }
}

async function terminalBatchCase() {
  const qualification = await createPi02Harness({ responses: [fauxAssistantMessage([
    fauxToolCall("printform_preview_changes", { expectedRevision: 0, operations: [COLOR_OPERATION] }, { id: "terminal-first" }),
    fauxToolCall("printform_get_project_summary", {}, { id: "after-terminal" })
  ], { stopReason: "toolUse" })] });
  try {
    const hostRun = await qualification.host.run("Preview and then read the summary.");
    return finish({ harness: { hostRun, proposals: qualification.host.proposals(), state: qualification.host.state(), events: qualification.host.events(), rawTypes: qualification.host.rawTypes() }, tools: qualification.host.tools, ...qualification });
  } finally { await qualification.host.dispose(); }
}

async function errorCase() {
  const malformed = await createPi02Harness({ responses: [fauxAssistantMessage([fauxToolCall("printform_preview_changes", { expectedRevision: "0", operations: [] }, { id: "malformed-1" })], { stopReason: "toolUse" })] });
  const commandFailure = await createPi02Harness({
    environmentOptions: { failPreview: true },
    responses: [fauxAssistantMessage([fauxToolCall("printform_preview_changes", { expectedRevision: 0, operations: [COLOR_OPERATION] }, { id: "command-error-1" })], { stopReason: "toolUse" })]
  });
  const missingTerminal = await createPi02Harness({ responses: [fauxAssistantMessage("I recommend changing the colour.", { stopReason: "stop" })] });
  try {
    const malformedRun = await malformed.host.run("Send malformed arguments.");
    const commandRun = await commandFailure.host.run("Trigger a gateway error.");
    const missingRun = await missingTerminal.host.run("Respond without using a terminal tool.");
    return {
      malformed: { run: malformedRun, calls: malformed.env.calls(), events: malformed.host.events(), proposals: malformed.host.proposals() },
      commandError: { run: commandRun, calls: commandFailure.env.calls(), events: commandFailure.host.events(), proposals: commandFailure.host.proposals() },
      missingTerminal: { run: missingRun, calls: missingTerminal.env.calls(), events: missingTerminal.host.events(), proposals: missingTerminal.host.proposals() },
      providerCalls: { malformed: malformed.faux.state.callCount, commandError: commandFailure.faux.state.callCount, missingTerminal: missingTerminal.faux.state.callCount }
    };
  } finally {
    await malformed.host.dispose(); await commandFailure.host.dispose(); await missingTerminal.host.dispose();
  }
}

function repeatedResponses(count) {
  return Array.from({ length: count }, (_, index) => fauxAssistantMessage([
    fauxToolCall("printform_get_project_summary", {}, { id: `repeat-${index}` })
  ], { stopReason: "toolUse" }));
}

async function budgetCase() {
  const action = await createPi02Harness({ responses: repeatedResponses(10), budget: { actionLimit: 8, repeatLimit: 100, tokenLimit: 1_000_000, maxSteps: 100 } });
  const repeat = await createPi02Harness({ responses: repeatedResponses(3), budget: { repeatLimit: 2, actionLimit: 8, maxSteps: 100 } });
  const token = await createPi02Harness({ responses: repeatedResponses(2), budget: { tokenLimit: 1, actionLimit: 8, maxSteps: 100 } });
  try {
    const actionRun = await action.host.run("Keep reading until the host stops the turn.");
    const repeatRun = await repeat.host.run("Repeat the same read action.");
    const tokenRun = await token.host.run("Use the token budget.");
    return {
      action: { run: actionRun, state: action.host.state(), events: action.host.events(), providerCalls: action.faux.state.callCount },
      repeat: { run: repeatRun, state: repeat.host.state(), events: repeat.host.events(), providerCalls: repeat.faux.state.callCount },
      token: { run: tokenRun, state: token.host.state(), events: token.host.events(), providerCalls: token.faux.state.callCount }
    };
  } finally { await action.host.dispose(); await repeat.host.dispose(); await token.host.dispose(); }
}

async function approvalCase() {
  const lost = await createPi02Harness({
    environmentOptions: { loseApplyResponse: true },
    responses: [fauxAssistantMessage([fauxToolCall("printform_preview_changes", { expectedRevision: 0, operations: [COLOR_OPERATION] }, { id: "apply-1" })], { stopReason: "toolUse" })]
  });
  const stale = await createPi02Harness({
    responses: [fauxAssistantMessage([fauxToolCall("printform_preview_changes", { expectedRevision: 0, operations: [COLOR_OPERATION] }, { id: "stale-1" })], { stopReason: "toolUse" })]
  });
  try {
    await lost.host.run("Preview for apply.");
    const applied = await lost.host.applyPendingProposal();
    await stale.host.run("Preview a stale candidate.");
    const changed = await stale.env.privateGateway.executeHuman("set_locale", { expectedRevision: 0, locale: "zh-CN" });
    let staleError = null;
    try { await stale.host.applyPendingProposal(); } catch (error) { staleError = { code: errorCode(error) }; }
    return {
      lostResponse: { applied, revision: lost.env.bus.revision, calls: lost.env.calls(), state: lost.host.state(), events: lost.host.events() },
      staleCandidate: { changed: changed?.ok === true, error: staleError, revision: stale.env.bus.revision, calls: stale.env.calls(), state: stale.host.state(), events: stale.host.events() }
    };
  } finally { await lost.host.dispose(); await stale.host.dispose(); }
}

export async function runPi02Case(caseId) {
  if (caseId === "15-01") return previewCase();
  if (caseId === "15-02") return reviewCase();
  if (caseId === "15-03") return terminalBatchCase();
  if (caseId === "15-04") return errorCase();
  if (caseId === "15-05") return budgetCase();
  if (caseId === "15-06") return approvalCase();
  throw Object.assign(new Error(`Unknown PI-02 case: ${caseId}`), { code: "CASE_UNKNOWN" });
}
