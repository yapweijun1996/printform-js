import { createModels, fauxAssistantMessage, fauxProvider } from "@earendil-works/pi-ai";
import { CommandBus } from "../core/command-bus.js";
import { classifySyntheticDocument } from "../core/data-policy.js";
import { hashRenderProject } from "../core/render-provenance.js";
import { installAgentGateway, bindAgentSession } from "../adapters/gateway.js";
import { createSalesInvoiceProject } from "../samples/sales-invoice.js";
import { createPiHostAdapter } from "./host-adapter.js";

export const PI02_PIN = Object.freeze({
  sourceCommit: "b2602be77cb7b0de45dd616407fd210daa48aa75",
  agentPackage: "@earendil-works/pi-agent-core@0.85.1",
  aiPackage: "@earendil-works/pi-ai@0.85.1",
  sessionRepo: "MemorySessionRepo",
  toolExecution: "sequential",
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
    issues: [],
    pageGeometry: [{ width: 750, height: 1050, children: [] }],
    safeSnapshot: {
      redacted: true, source: "geometry-only", mimeType: "image/svg+xml", pageCount: 1,
      dataUrl: "data:image/svg+xml;base64,PHN2Zy8+"
    }
  };
}

function publicCalls(calls) {
  return calls.map(({ surface, name }) => ({ surface, name }));
}

export async function createQualificationEnvironment({ failPreview = false, loseApplyResponse = false } = {}) {
  const sessionId = "pi02-agent";
  const policy = classifySyntheticDocument("pi02-qualification");
  const bus = new CommandBus(createSalesInvoiceProject(), {
    dataPolicy: policy,
    renderCandidate: async () => readyReport()
  });
  const projectHash = await hashRenderProject(bus.project);
  bus.recordRenderReport(readyReport(), {
    source: "committed", revision: bus.revision, candidateHash: projectHash, baseProjectHash: projectHash,
    visualMode: "geometry"
  });
  const calls = [];
  let uiSessionFactory;
  const installed = installAgentGateway(bus, {}, {
    sessionId, dataPolicy: policy, getDataPolicy: () => policy,
    getScopeContext: () => ({ kind: "document" }), getApplyMode: () => "preview",
    onUiSessionFactory: (factory) => { uiSessionFactory = factory; }
  });
  const agentSession = bindAgentSession(installed, sessionId);
  const uiSession = uiSessionFactory(sessionId);
  let lost = false;
  const agentGateway = {
    execute: async (name, input = {}) => {
      calls.push({ surface: "agent", name });
      if (failPreview && name === "preview_changes") return { ok: false, error: { code: "SCOPE_VIOLATION", message: "Command failed" } };
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
      const response = await uiSession.executeHuman(name, input);
      if (name === "apply_changes" && loseApplyResponse && !lost && response?.ok) {
        lost = true;
        throw Object.assign(new Error("Synthetic apply response lost."), { code: "COMMIT_RESPONSE_LOST" });
      }
      return response;
    }
  };
  return {
    bus, policy, agentGateway, privateGateway,
    calls: () => publicCalls(calls),
    readyReport
  };
}

export async function createPi02Harness({
  responses, environment = null, environmentOptions = {}, budget = {}, reviewHooks = {}, systemPrompt = "Use one PrintForm tool and stop after a terminal result."
} = {}) {
  const env = environment || await createQualificationEnvironment(environmentOptions);
  const faux = fauxProvider({ provider: "pi02-faux", models: [{ id: "pi02-qualification" }], tokenSize: { min: 3, max: 3 } });
  faux.setResponses(responses || [fauxAssistantMessage("qualification-complete", { stopReason: "stop" })]);
  const models = createModels();
  models.setProvider(faux.provider);
  const events = [];
  const host = await createPiHostAdapter({
    models, model: faux.getModel(), gateway: env.agentGateway, privateGateway: env.privateGateway,
    sessionId: "pi02-agent", systemPrompt, budget, reviewHooks, onEvent: (event) => events.push(event)
  });
  return { env, faux, host, events };
}

export async function prepareReview(env) {
  const started = await env.agentGateway.execute("begin_layout_review", { expectedRevision: env.bus.revision });
  if (!started?.ok) throw Object.assign(new Error("Review setup failed."), { code: started?.error?.code || "REVIEW_SETUP_FAILED" });
  const captured = [];
  for (const scenario of ["default", "long-text"]) {
    const response = await env.agentGateway.execute("capture_layout_evidence", {
      expectedRevision: env.bus.revision, scenario, visualMode: "geometry"
    });
    if (!response?.ok) throw Object.assign(new Error("Evidence setup failed."), { code: response?.error?.code || "EVIDENCE_SETUP_FAILED" });
    const evidenceId = response.result?.evidence?.evidenceId;
    if (typeof evidenceId !== "string") throw Object.assign(new Error("Evidence reference is missing."), { code: "EVIDENCE_SETUP_FAILED" });
    captured.push({ scenario, evidenceId });
  }
  return { started, captured, evidenceIds: captured.map(({ evidenceId }) => evidenceId) };
}
