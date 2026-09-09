import { AgentHarness, BACKGROUND_CONTEXT } from "@earendil-works/pi-agent-core";
import { createModels, fauxAssistantMessage, fauxProvider } from "@earendil-works/pi-ai";
import { CommandBus } from "../core/command-bus.js";
import { classifyImportedDocument } from "../core/data-policy.js";
import { installAgentGateway, bindAgentSession } from "../adapters/gateway.js";
import { createFileExport } from "../ui/studio-file-export.js";
import { createSalesInvoiceProject } from "../samples/sales-invoice.js";
import { createPiByokAdapter } from "../pi-01/provider-transport.js";
import { createPiHostAdapter } from "../pi-02/host-adapter.js";
import { PolicySessionRepo } from "../pi-03/policy-session-repo.js";
import { renderCurrentProject, renderProject } from "./qualification-render.js";

export const PI04_CONTEXT = "pi04-x01-context";
export const PI04_DOCUMENT_ID = "pi04-x01-canary";
export const PI04_CANARY = "PI04-PRIVATE-CANARY-20260909";
export const PI04_TABLE_SELECTOR = ".scope-table-a-header, .scope-table-a-row";
export const PI04_TABLE_OPERATION = Object.freeze({
  type: "set_column_widths", tableSelector: PI04_TABLE_SELECTOR,
  widths: ["12%", "43%", "11%", "16%", "18%"]
});

export const PI04_PIN = Object.freeze({
  sourceCommit: "b2602be77cb7b0de45dd616407fd210daa48aa75",
  agentPackage: "@earendil-works/pi-agent-core@0.85.1",
  aiPackage: "@earendil-works/pi-ai@0.85.1",
  harness: "AgentHarness",
  sessionRepo: "PolicySessionRepo",
  defaultUnknownSession: "memory",
  appBackend: false,
  providerProxy: false
});

export function browserRuntime() {
  return {
    process: typeof globalThis.process, require: typeof globalThis.require, Buffer: typeof globalThis.Buffer,
    nodeGlobalsAbsent: [globalThis.process, globalThis.require, globalThis.Buffer].every((value) => value === undefined)
  };
}

function readyReport() {
  return {
    status: "ready",
    validation: { valid: true, productionValid: true, errors: [], warnings: [] },
    metrics: { logicalPages: 1, overflowElements: 0, verticalOverflowPages: 0, contrastFailures: 0 },
    issues: [], pageGeometry: [{ width: 750, height: 1050, children: [] }],
    safeSnapshot: { redacted: true, source: "geometry-only", mimeType: "image/svg+xml", pageCount: 1, dataUrl: "data:image/svg+xml;base64,PHN2Zy8+" }
  };
}

function projectFixture(documentId = PI04_DOCUMENT_ID, canary = PI04_CANARY) {
  const project = createSalesInvoiceProject();
  project.manifest = { ...project.manifest, documentId, title: "PI-04 Imported Canary" };
  project.sampleData = { ...project.sampleData, customer: { ...project.sampleData.customer, name: canary } };
  project.templateHtml = project.templateHtml
    .replace('class="prowheader pf-grid"', 'class="prowheader pf-grid scope-table-a-header" data-pf-table-id="a"')
    .replace('class="prowitem pf-grid"', 'class="prowitem pf-grid scope-table-a-row" data-pf-table-id="a"');
  return project;
}

function publicCalls(calls) { return calls.map(({ surface, name }) => ({ surface, name })); }

async function recordCurrentRender(bus) {
  return renderCurrentProject(bus);
}

export async function createPi04Environment({ applyMode = "preview", documentId = PI04_DOCUMENT_ID, canary = PI04_CANARY, transactionNamespace = PI04_CONTEXT, dataPolicy = null } = {}) {
  const policy = dataPolicy || classifyImportedDocument(documentId);
  let currentPolicy = policy;
  let currentApplyMode = applyMode === "auto" ? "auto" : "preview";
  let scope = { kind: "table", tableId: "a" };
  const bus = new CommandBus(projectFixture(documentId, canary), {
    dataPolicy: policy, transactionNamespace,
    renderCandidate: async (candidate, revision) => {
      candidateRenderCount += 1;
      return renderProject(bus, candidate, revision, "candidate");
    }
  });
  const calls = [];
  let candidateRenderCount = 0;
  let uiSessionFactory;
  const installed = installAgentGateway(bus, globalThis, {
    sessionId: "pi04-agent", getDataPolicy: () => currentPolicy,
    getScopeContext: () => scope, getApplyMode: () => currentApplyMode,
    onUiSessionFactory: (factory) => { uiSessionFactory = factory; }
  });
  const agentSession = bindAgentSession(installed, "pi04-agent");
  const uiSession = uiSessionFactory("pi04-agent");
  const agentGateway = {
    execute: async (name, input = {}) => {
      calls.push({ surface: "agent", name });
      return agentSession.execute(name, input);
    }
  };
  const privateGateway = {
    execute: async (name, input = {}) => {
      calls.push({ surface: "private", name });
      return uiSession.execute(name, input);
    },
    executeHuman: async (name, input = {}) => {
      calls.push({ surface: "human", name });
      return uiSession.executeHuman(name, input);
    }
  };
  const sessionRepo = new PolicySessionRepo({ dataPolicy: policy, getDataPolicy: () => currentPolicy });
  const session = await sessionRepo.create({ id: "pi04-agent-session" }, BACKGROUND_CONTEXT);
  return {
    bus, policy, sessionRepo, session, agentGateway, privateGateway,
    calls: () => publicCalls(calls),
    candidateRenderCount: () => candidateRenderCount,
    sessionMode: () => sessionRepo.describe().mode,
    applyMode: () => currentApplyMode,
    scope: () => structuredClone(scope),
    setApplyMode(next) { currentApplyMode = next === "auto" ? "auto" : "preview"; },
    setScope(next) { scope = structuredClone(next); },
    setPolicy(next) { currentPolicy = next; sessionRepo.setDataPolicy(next); },
    currentPolicy: () => currentPolicy,
    recordCurrentRender: () => recordCurrentRender(bus),
    readyReport,
    async close() { bus.deactivate(); await sessionRepo.close(BACKGROUND_CONTEXT); }
  };
}

export async function createPi04Harness(environment, { responses = [], reviewHooks = {}, sessionId = "pi04-agent" } = {}) {
  const faux = fauxProvider({ provider: "pi04-faux", models: [{ id: "pi04-qualification" }], tokenSize: { min: 3, max: 3 } });
  faux.setResponses(responses);
  const models = createModels();
  models.setProvider(faux.provider);
  const session = sessionId === "pi04-agent"
    ? environment.session
    : await environment.sessionRepo.create({ id: `${sessionId}-session` }, BACKGROUND_CONTEXT);
  const host = await createPiHostAdapter({
    models, model: faux.getModel(), gateway: environment.agentGateway,
    privateGateway: environment.privateGateway, sessionId,
    systemPrompt: "Use the PrintForm tools and stop after the requested terminal action.",
    sessionRepo: environment.sessionRepo, session,
    reviewHooks
  });
  return { faux, host };
}

export async function createPi04DirectHarness(environment, { profile, apiKey, sessionId = "pi04-direct" } = {}) {
  const adapter = createPiByokAdapter(profile, { apiKey });
  try {
    const host = await createPiHostAdapter({
      models: adapter.models, model: adapter.model, gateway: environment.agentGateway,
      privateGateway: environment.privateGateway, sessionId,
      systemPrompt: "Use the PrintForm tools and stop after the requested terminal action.",
      sessionRepo: environment.sessionRepo, session: environment.session
    });
    return { adapter, host };
  } catch (error) {
    adapter.dispose();
    throw error;
  }
}

export async function prepareReview(environment) {
  const expectedRevision = environment.bus.revision;
  const started = await environment.agentGateway.execute("begin_layout_review", { expectedRevision });
  if (!started?.ok) throw Object.assign(new Error("PI-04 review setup failed."), { code: started?.error?.code || "REVIEW_SETUP_FAILED" });
  const evidenceIds = [];
  for (const scenario of ["default", "long-text"]) {
    const captured = await environment.agentGateway.execute("capture_layout_evidence", {
      expectedRevision, scenario, visualMode: "geometry"
    });
    if (!captured?.ok || typeof captured.result?.evidence?.evidenceId !== "string") {
      throw Object.assign(new Error("PI-04 geometry evidence setup failed."), { code: captured?.error?.code || "EVIDENCE_SETUP_FAILED" });
    }
    evidenceIds.push(captured.result.evidence.evidenceId);
  }
  return { attempt: started.result.attempt, evidenceIds };
}

export async function exportCurrent(environment) {
  const originalFetch = globalThis.fetch;
  const originalConfirm = window.confirm;
  const picker = Object.getOwnPropertyDescriptor(window, "showSaveFilePicker");
  const savedStates = [];
  let writtenHtml = "";
  let confirmCalls = 0;
  globalThis.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input?.url;
    if (url === "../dist/printform-document.js" || url === "../dist/printform.js") {
      return originalFetch(`/dist/${url.slice("../dist/".length)}`, init);
    }
    return originalFetch(input, init);
  };
  window.confirm = () => { confirmCalls += 1; return true; };
  Object.defineProperty(window, "showSaveFilePicker", {
    configurable: true, writable: true,
    value: async () => ({ createWritable: async () => ({
      write: async (value) => { writtenHtml = String(value); }, close: async () => {}
    }) })
  });
  try {
    const exportDocument = createFileExport({
      getBus: () => environment.bus, getDataPolicy: environment.currentPolicy,
      setDirty: (value) => savedStates.push({ type: "dirty", value }),
      setSaveState: (value) => savedStates.push({ type: "save", value }), toast: () => {}
    });
    const result = await exportDocument(true);
    return {
      result, evidenceRevision: environment.bus.evidencePack?.revision ?? null,
      embeddedRevision: writtenHtml.includes('"revision": 1') ? 1 : null,
      htmlBytes: new TextEncoder().encode(writtenHtml).byteLength, confirmCalls, savedStates
    };
  } finally {
    globalThis.fetch = originalFetch;
    window.confirm = originalConfirm;
    if (picker) Object.defineProperty(window, "showSaveFilePicker", picker);
    else delete window.showSaveFilePicker;
  }
}
