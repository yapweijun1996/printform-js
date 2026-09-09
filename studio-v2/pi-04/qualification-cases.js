import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import { createPi04Environment, createPi04Harness, exportCurrent, PI04_CANARY, PI04_TABLE_OPERATION, prepareReview } from "./qualification-env.js";

function errorCode(error) { return error?.code || "PI04_CASE_FAILED"; }

function previewResponse() {
  return fauxAssistantMessage([fauxToolCall("printform_preview_changes", {
    expectedRevision: 0, operations: [PI04_TABLE_OPERATION]
  }, { id: "pi04-x01-preview" })], { stopReason: "toolUse" });
}

function reviewResponse() {
  return fauxAssistantMessage([fauxToolCall("printform_complete_current_layout_review", {
    findings: [], summary: "Current geometry evidence has no blocking findings."
  }, { id: "pi04-x01-review" })], { stopReason: "toolUse" });
}

function countEditRevisions(bus) {
  return bus.history.entries.map((entry) => entry.revision);
}

function trackIndexedDbOpens() {
  const prototype = Object.getPrototypeOf(globalThis.indexedDB);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "open");
  if (!descriptor || typeof descriptor.value !== "function") throw new Error("IndexedDB open instrumentation is unavailable.");
  let count = 0;
  Object.defineProperty(prototype, "open", { ...descriptor, value: function trackedOpen(...args) {
    count += 1;
    return descriptor.value.apply(this, args);
  } });
  return { count: () => count, restore: () => Object.defineProperty(prototype, "open", descriptor) };
}

export async function runPi04X01() {
  const environment = await createPi04Environment();
  const indexedDb = trackIndexedDbOpens();
  const providerContexts = [];
  const qualification = await createPi04Harness(environment, {
    responses: [(context) => { providerContexts.push(context); return previewResponse(); }]
  });
  try {
    const formSpec = await environment.agentGateway.execute("get_form_spec");
    const hasTableReference = formSpec?.result?.spec?.components?.some((component) =>
      component?.role === "table-header" && typeof component.tableId === "string" && component.tableId.startsWith("ref:table:"));
    if (!formSpec?.ok || !hasTableReference) {
      throw Object.assign(new Error(`Table A semantic identity was not available: ${JSON.stringify({ ok: formSpec?.ok, result: formSpec?.result })}`), { code: "TABLE_A_SCOPE_MISSING" });
    }
    const firstRun = await qualification.host.run("Preview one valid table A edit.");
    if (!firstRun.ok || qualification.host.proposals().length !== 1) {
      throw Object.assign(new Error("The PI-04 preview did not produce one proposal."), { code: "PREVIEW_NOT_PROPOSED" });
    }
    const proposal = qualification.host.proposals()[0];
    const applied = await qualification.host.applyPendingProposal(proposal.proposalId);
    const render = await environment.recordCurrentRender();
    const review = await prepareReview(environment);
    qualification.faux.setResponses([(context) => { providerContexts.push(context); return reviewResponse(); }]);
    const reviewRun = await qualification.host.run("Complete the current layout review.");
    const exported = await exportCurrent(environment);
    const safeOutput = JSON.stringify({ firstRun, applied, render, reviewRun, exported });
    const providerSawCanary = providerContexts.some((context) => {
      try { return JSON.stringify(context).includes(PI04_CANARY); } catch { return true; }
    });
    return {
      mode: "preview", policy: environment.policy.classification, scope: environment.scope(),
      sessionMode: environment.sessionMode(), indexedDbOpens: indexedDb.count(),
      providerCalls: qualification.faux.state.callCount,
      providerSawCanary,
      noCanaryInQualificationOutput: !safeOutput.includes(PI04_CANARY),
      firstRun, proposal, applied, render, review: { attempt: review.attempt, evidenceCount: review.evidenceIds.length, run: reviewRun },
      revision: environment.bus.revision, revisionEntries: countEditRevisions(environment.bus),
      readiness: environment.bus.readiness().productionValid ? "ready" : "blocked",
      export: {
        ok: exported.result.ok, mode: exported.result.mode, filename: exported.result.filename,
        evidenceRevision: exported.evidenceRevision, embeddedRevision: exported.embeddedRevision,
        htmlBytes: exported.htmlBytes, confirmCalls: exported.confirmCalls,
        saveStates: exported.savedStates.map((entry) => entry.type === "save" ? entry.value : entry)
      },
      calls: environment.calls(), terminalEvents: qualification.host.events().filter((event) => event.type === "terminal_state").length,
      noUnauthorizedCanaryPersistence: environment.sessionMode() === "memory" && environment.policy.allowPersistentSessions === false && indexedDb.count() === 0,
      noUnauthorizedCanaryExposure: !providerSawCanary,
      errors: []
    };
  } catch (error) {
    return { failed: true, error: { code: errorCode(error), message: error?.message || String(error) } };
  } finally {
    indexedDb.restore();
    await qualification.host.dispose();
    await environment.close();
  }
}

export async function runPi04Case(caseId) {
  if (caseId === "17-01") return runPi04X01();
  throw Object.assign(new Error(`Unknown PI-04 case: ${caseId}`), { code: "CASE_UNKNOWN" });
}
