import { BACKGROUND_CONTEXT } from "@earendil-works/pi-agent-core";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import { classifyImportedDocument, classifyRealDocument } from "../core/data-policy.js";
import { hashRenderProject } from "../core/render-provenance.js";
import { createPi04DirectHarness, createPi04Environment, createPi04Harness, exportCurrent, PI04_CANARY, PI04_DOCUMENT_ID, PI04_TABLE_OPERATION, prepareReview } from "./qualification-env.js";
import { runPi04DirectCommitRecovery } from "./qualification-transaction.js";

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
  let reviewQualification = null;
  try {
    const formSpec = await environment.agentGateway.execute("get_form_spec");
    const hasTableReference = formSpec?.result?.spec?.components?.some((component) =>
      component?.role === "table-header" && typeof component.tableId === "string" && component.tableId.startsWith("ref:table:"));
    if (!formSpec?.ok || !hasTableReference) {
      throw Object.assign(new Error("Table A semantic identity was not available."), { code: "TABLE_A_SCOPE_MISSING" });
    }
    const firstRun = await qualification.host.run("Preview one valid table A edit.");
    if (!firstRun.ok || qualification.host.proposals().length !== 1) {
      throw Object.assign(new Error("The PI-04 preview did not produce one proposal."), { code: "PREVIEW_NOT_PROPOSED" });
    }
    const proposal = qualification.host.proposals()[0];
    const applied = await qualification.host.applyPendingProposal(proposal.proposalId);
    const render = await environment.recordCurrentRender();
    const review = await prepareReview(environment);
    reviewQualification = await createPi04Harness(environment, {
      sessionId: "pi04-review",
      responses: [(context) => { providerContexts.push(context); return reviewResponse(); }],
      reviewHooks: {
        completeInput: (args) => ({ ...args, expectedRevision: environment.bus.revision, reviewer: "ai-agent", evidenceIds: review.evidenceIds }),
        markComplete: () => {}
      }
    });
    const reviewRun = await reviewQualification.host.run("Complete the current layout review.");
    const exported = await exportCurrent(environment);
    const safeOutput = JSON.stringify({ firstRun, applied, render, reviewRun, exported });
    const providerSawCanary = providerContexts.some((context) => {
      try { return JSON.stringify(context).includes(PI04_CANARY); } catch { return true; }
    });
    return {
      mode: "preview", policy: environment.policy.classification, scope: environment.scope(),
      sessionMode: environment.sessionMode(), candidateRenderCount: environment.candidateRenderCount(), indexedDbOpens: indexedDb.count(),
      providerCalls: qualification.faux.state.callCount + reviewQualification.faux.state.callCount,
      providerSawCanary,
      noCanaryInQualificationOutput: !safeOutput.includes(PI04_CANARY),
      firstRun, proposal, applied, render, review: { attempt: review.attempt, evidenceCount: review.evidenceIds.length, run: reviewRun },
      revision: environment.bus.revision, revisionEntries: countEditRevisions(environment.bus),
      readiness: environment.bus.readiness().productionValid ? "ready" : "blocked",
      export: {
        ok: exported.result.ok, mode: exported.result.mode, filename: exported.result.filename,
        evidenceRevision: exported.evidenceRevision, embeddedRevision: exported.embeddedRevision,
        htmlBytes: exported.htmlBytes, confirmCalls: exported.confirmCalls,
        saveStates: exported.savedStates.filter((entry) => entry.type === "save").map((entry) => entry.value)
      },
      calls: environment.calls(), terminalEvents: qualification.host.events().filter((event) => event.type === "terminal_state").length + reviewQualification.host.events().filter((event) => event.type === "terminal_state").length,
      noUnauthorizedCanaryPersistence: environment.sessionMode() === "memory" && environment.policy.allowPersistentSessions === false && indexedDb.count() === 0,
      noUnauthorizedCanaryExposure: !providerSawCanary,
      errors: []
    };
  } catch (error) {
    return { failed: true, error: { code: errorCode(error), message: error?.message || String(error) } };
  } finally {
    await reviewQualification?.host.dispose();
    indexedDb.restore();
    await qualification.host.dispose();
    await environment.close();
  }
}

async function runPi04X02() {
  const environment = await createPi04Environment({ applyMode: "auto" });
  const initialHash = await hashRenderProject(environment.bus.project);
  const providerContexts = [];
  let release;
  let pending;
  let qualification;
  try {
    let markStarted;
    const started = new Promise((resolve) => { markStarted = resolve; });
    qualification = await createPi04Harness(environment, {
      responses: [async (context) => {
        providerContexts.push(context);
        markStarted();
        await new Promise((resolve) => { release = resolve; });
        return previewResponse();
      }]
    });
    pending = qualification.host.run("Preview one edit while policy and scope change.");
    await started;
    environment.setPolicy(classifyRealDocument(PI04_DOCUMENT_ID));
    environment.setApplyMode("preview");
    environment.setScope({ kind: "component", componentId: "table-a-header" });
    release?.();
    const run = await pending;
    const readiness = environment.bus.readiness();
    const currentHash = await hashRenderProject(environment.bus.project);
    const harnessEvents = qualification.host.events().map((event) => ({ type: event.type, code: event.detail?.code, status: event.detail?.status }));
    const safeOutput = JSON.stringify({ run, readiness, scope: environment.scope(), applyMode: environment.applyMode(), harnessEvents });
    return {
      policy: environment.currentPolicy().classification, applyMode: environment.applyMode(), scope: environment.scope(),
      sessionMode: environment.sessionMode(), run, revision: environment.bus.revision,
      committedContentAvailable: currentHash === initialHash, noStaleCommit: environment.bus.revision === 0,
      readiness: { productionValid: readiness.productionValid, codes: readiness.errors.map((item) => item.code) },
      noMisleadingStatus: !readiness.productionValid && run.status !== "ready" && run.status !== "saved",
      harnessEvents, providerSawCanary: providerContexts.some((context) => JSON.stringify(context).includes(PI04_CANARY)),
      noCanaryInQualificationOutput: !safeOutput.includes(PI04_CANARY), errors: []
    };
  } catch (error) {
    return { failed: true, error: { code: errorCode(error), message: error?.message || String(error) } };
  } finally {
    release?.();
    await pending?.catch(() => {});
    await qualification?.host.dispose();
    await environment.close();
  }
}

async function runPi04X03() {
  const documentA = "pi04-x03-document-a";
  const documentB = "pi04-x03-document-b";
  const first = await createPi04Environment({ documentId: documentA, canary: "PI04-DOCUMENT-A-CANARY", transactionNamespace: "pi04-x03-a" });
  const second = await createPi04Environment({ documentId: documentB, canary: "PI04-DOCUMENT-B-CANARY", transactionNamespace: "pi04-x03-b" });
  const firstHash = await hashRenderProject(first.bus.project);
  const secondHash = await hashRenderProject(second.bus.project);
  let pending;
  let release;
  let qualification;
  try {
    await first.recordCurrentRender();
    const review = await prepareReview(first);
    let markStarted;
    const started = new Promise((resolve) => { markStarted = resolve; });
    qualification = await createPi04Harness(first, {
      responses: [async (context) => {
        markStarted();
        await new Promise((resolve) => { release = resolve; });
        return reviewResponse();
      }],
      reviewHooks: {
        completeInput: (args) => ({ ...args, expectedRevision: first.bus.revision, reviewer: "ai-agent", evidenceIds: review.evidenceIds }),
        markComplete: () => {}
      }
    });
    pending = qualification.host.run("Review document A while the active document changes.");
    await started;
    first.setPolicy(classifyImportedDocument(documentB));
    first.bus.deactivate();
    const activeDocument = "b";
    release?.();
    const oldRun = await pending;
    const firstAfterHash = await hashRenderProject(first.bus.project);
    const secondEntries = await second.session.findEntries({ order: "asc" }, BACKGROUND_CONTEXT);
    const secondReadiness = second.bus.readiness();
    const safeOutput = JSON.stringify({ oldRun, activeDocument, secondReadiness, secondEntries: secondEntries.length });
    return {
      activeDocument, oldRun, oldRunError: oldRun.error?.code || null,
      firstRevision: first.bus.revision, firstProjectStable: firstAfterHash === firstHash,
      second: {
        documentId: second.currentPolicy().documentId, classification: second.currentPolicy().classification,
        scope: second.scope(), applyMode: second.applyMode(), revision: second.bus.revision,
        projectStable: (await hashRenderProject(second.bus.project)) === secondHash,
        evidencePackPresent: Boolean(second.bus.evidencePack), chatEntryCount: secondEntries.length,
        readinessProductionValid: secondReadiness.productionValid,
        readinessCodes: secondReadiness.errors.map((item) => item.code)
      },
      noCanaryInQualificationOutput: !safeOutput.includes("PI04-DOCUMENT-A-CANARY") && !safeOutput.includes("PI04-DOCUMENT-B-CANARY"),
      errors: []
    };
  } catch (error) {
    return { failed: true, error: { code: errorCode(error), message: error?.message || String(error) } };
  } finally {
    release?.();
    await pending?.catch(() => {});
    await qualification?.host.dispose();
    await first.close();
    await second.close();
  }
}

async function runPi04DirectProvider({ provider, profileProvider = "custom", endpoint, model, apiVariant, key, casePrompt, environmentOptions = {} }) {
  const environment = await createPi04Environment(environmentOptions);
  let qualification;
  try {
    qualification = await createPi04DirectHarness(environment, {
      profile: { id: `pi04-direct-${apiVariant}`, provider: profileProvider, endpoint, model, apiVariant }, apiKey: key
    });
    const run = await qualification.host.run(casePrompt);
    const proposals = qualification.host.proposals();
    const safeOutput = JSON.stringify({ run, proposals, events: qualification.host.events() });
    return {
      provider, run, proposalCount: proposals.length, proposal: proposals[0] || null,
      calls: environment.calls(), revision: environment.bus.revision, sessionMode: environment.sessionMode(),
      policy: environment.currentPolicy().classification, persistentStorageAllowed: environment.currentPolicy().allowPersistentSessions,
      candidateRenderCount: environment.candidateRenderCount(),
      noCanaryInQualificationOutput: !safeOutput.includes(PI04_CANARY),
      noProviderCredentialInQualificationOutput: !safeOutput.includes(key), errors: []
    };
  } catch (error) {
    return { failed: true, error: { code: errorCode(error), message: error?.message || String(error) } };
  } finally {
    await qualification?.host.dispose();
    qualification?.adapter.dispose();
    await environment.close();
  }
}

async function runPi04DirectChat() {
  return runPi04DirectProvider({ provider: "openai-compatible-chat", endpoint: "https://provider.test/v1",
    model: "pi04-chat", apiVariant: "chat", key: "PI04-DIRECT-SYNTHETIC-KEY",
    casePrompt: "Preview one valid table A edit through the direct provider." });
}

async function runPi04DirectResponses() {
  return runPi04DirectProvider({ provider: "openai-responses", endpoint: "https://api.openai.com/v1",
    model: "pi04-responses", apiVariant: "responses", key: "PI04-RESPONSES-SYNTHETIC-KEY",
    casePrompt: "Preview one valid table A edit through the direct Responses provider." });
}

async function runPi04DirectGemini() {
  return runPi04DirectProvider({ provider: "google-gemini", profileProvider: "gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta", model: "pi04-gemini", apiVariant: "chat",
    key: "PI04-GEMINI-SYNTHETIC-KEY", casePrompt: "Preview one valid table A edit through the direct Gemini provider." });
}

async function runPi04DirectFollowUp() {
  return runPi04DirectProvider({ provider: "openai-chat-follow-up", endpoint: "https://provider.test/v1",
    model: "pi04-follow-up", apiVariant: "chat", key: "PI04-FOLLOW-UP-SYNTHETIC-KEY",
    casePrompt: "Read the safe summary, then preview one valid table A edit through the direct provider." });
}

async function runPi04DirectRealPrivacy() {
  return runPi04DirectProvider({ provider: "openai-compatible-chat-real-privacy", endpoint: "https://provider.test/v1",
    model: "pi04-real-privacy", apiVariant: "chat", key: "PI04-REAL-PRIVACY-SYNTHETIC-KEY",
    environmentOptions: { dataPolicy: classifyRealDocument(PI04_DOCUMENT_ID) },
    casePrompt: "Preview one valid table A edit without exposing document values." });
}

export async function runPi04Case(caseId) {
  if (caseId === "17-01") return runPi04X01();
  if (caseId === "17-02") return runPi04X02();
  if (caseId === "17-03") return runPi04X03();
  if (caseId === "17-04") return runPi04DirectChat();
  if (caseId === "17-05") return runPi04DirectResponses();
  if (caseId === "17-06") return runPi04DirectGemini();
  if (caseId === "17-07") return runPi04DirectFollowUp();
  if (caseId === "17-08") return runPi04DirectCommitRecovery();
  if (caseId === "17-09") return runPi04DirectRealPrivacy();
  throw Object.assign(new Error(`Unknown PI-04 case: ${caseId}`), { code: "CASE_UNKNOWN" });
}
