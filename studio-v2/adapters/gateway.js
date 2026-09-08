import { AGENT_CONTRACT_VERSION } from "../core/constants.js";
import { TOOL_CONTRACTS } from "../core/tool-contracts.js";
import { AGENT_OPERATION_DEFINITIONS } from "../core/operation-schemas.js";
import { classifyImportedDocument, classifyRealDocument } from "../core/data-policy.js";
import { createAgentContext, createAgentSessionId, createPassthroughReferences, createReferenceRegistry, defaultPolicyForOptions, resolveAgentInput } from "../core/agent-context.js";
import { sanitizeAgentResponse } from "../core/agent-sanitize.js";

const PUBLIC_COMMANDS = new Set(TOOL_CONTRACTS.map((tool) => tool.name));
const MUTATIONS = new Set(["apply_changes", "set_sample_scenario", "set_locale", "set_asset_source", "undo_revision", "redo_revision", "renew_lease", "release_lease", "recover_transaction", "resolve_conflict", "rollback_transaction", "takeover_transaction", "approve_transaction"]);
const HUMAN_APPROVAL_COMMANDS = new Set(["approve_transaction", "apply_changes", "set_sample_scenario", "set_locale", "set_asset_source", "undo_revision"]);
const SESSION_BINDERS = new WeakMap();

function safeFailure(code) { return { ok: false, error: { code, message: "Command failed" } }; }

function rejectRawAgentSurface(name, input) {
  if (name === "preview_source_edit") return { code: "AGENT_RAW_SOURCE_BLOCKED" };
  if (!PUBLIC_COMMANDS.has(name)) return { code: "UNKNOWN_TOOL" };
  if (name !== "preview_changes" || !Array.isArray(input?.operations)) return null;
  const unsafe = input.operations.find((operation) => !operation || !AGENT_OPERATION_DEFINITIONS[operation.type]);
  return unsafe ? { code: "AGENT_OPERATION_NOT_ALLOWED" } : null;
}

function makeContext(options, humanApproval = false) {
  const policy = defaultPolicyForOptions(options);
  const currentPolicy = typeof options.getDataPolicy === "function" ? options.getDataPolicy() : null;
  const activePolicy = currentPolicy || policy;
  const legacy = Boolean(options.legacy);
  const sessionId = options.sessionId || (typeof options.getSessionId === "function" ? options.getSessionId() : null);
  return createAgentContext({
    dataPolicy: activePolicy,
    scope: typeof options.getScopeContext === "function" ? options.getScopeContext() : options.scope,
    applyMode: typeof options.getApplyMode === "function" ? options.getApplyMode() : options.applyMode || "auto",
    sessionId,
    currentPolicy: typeof options.getDataPolicy === "function" ? () => options.getDataPolicy() : null,
    source: options.source || "agent",
    humanApproval,
    legacy,
    references: typeof options.getReferences === "function"
      ? options.getReferences(activePolicy, sessionId)
      : (options.references || (legacy ? createPassthroughReferences() : null)),
  });
}

export async function executeAgentCommand(bus, name, input, options = {}) {
  const directLegacy = !options.context && !options.getDataPolicy && !options.dataPolicy && !options.scope && !options.getScopeContext;
  const suppliedPolicy = options.dataPolicy || options.getDataPolicy?.();
  const fallbackPolicy = options.realData
    ? classifyRealDocument(bus.project.manifest?.documentId)
    : (directLegacy && bus.dataPolicy
      ? bus.dataPolicy
      : (bus.dataPolicy?.classification === "unknown"
      ? bus.dataPolicy
      : classifyImportedDocument(bus.project.manifest?.documentId)));
  const context = options.context || makeContext({ ...options, legacy: options.legacy ?? directLegacy, dataPolicy: suppliedPolicy || fallbackPolicy }, Boolean(options.humanApproval));
  if (context.dataPolicy?.classification !== "synthetic" && name === "capture_layout_evidence" && input?.visualMode === "pixels") return safeFailure("PIXEL_EVIDENCE_SYNTHETIC_ONLY");
  if (bus.project.trust === "untrusted" && MUTATIONS.has(name)) return safeFailure("UNTRUSTED_READ_ONLY");
  const rawSurfaceError = rejectRawAgentSurface(name, input);
  if (rawSurfaceError) return safeFailure(rawSurfaceError.code);
  let resolvedInput;
  try { resolvedInput = resolveAgentInput(input, context.references); }
  catch (error) { return safeFailure(error.code || "REFERENCE_NOT_FOUND"); }
  const response = await bus.execute(name, resolvedInput, context);
  const projected = sanitizeAgentResponse(name, response, { context });
  if (!context.isCurrent()) {
    const outcome = projected.ok && (projected.result?.transactionId || projected.result?.transaction?.transaction_id);
    return { ok: false, error: { code: "STALE_POLICY_CONTEXT", message: "Command failed", ...(outcome ? { transactionId: outcome } : {}) } };
  }
  return projected;
}

export function installAgentGateway(bus, globalScope = window, options = {}) {
  let fallbackPolicy = null;
  const referenceRegistries = new Map();
  const defaultSessionId = options.sessionId || createAgentSessionId("gateway");
  const gatewayOptions = {
    ...options,
    getReferences: (policy, sessionId) => {
      const nextContext = JSON.stringify([sessionId || defaultSessionId, policy?.contextId || "unknown", policy?.generation || 0, policy?.documentId || null]);
      if (!referenceRegistries.has(nextContext)) referenceRegistries.set(nextContext, createReferenceRegistry());
      return referenceRegistries.get(nextContext);
    },
    getDataPolicy: (() => {
      if (options.getDataPolicy) return () => {
        const current = options.getDataPolicy();
        if (current) return current;
        if (!fallbackPolicy || fallbackPolicy.classification !== "unknown"
          || fallbackPolicy.documentId !== bus.project.manifest?.documentId) {
          fallbackPolicy = bus.dataPolicy?.classification === "unknown"
            ? bus.dataPolicy
            : classifyImportedDocument(bus.project.manifest?.documentId);
        }
        return fallbackPolicy;
      };
      if (options.dataPolicy) return () => options.dataPolicy;
      return () => {
        if (options.isRealData?.()) {
          if (!fallbackPolicy || fallbackPolicy.classification !== "real") fallbackPolicy = classifyRealDocument(bus.project.manifest?.documentId);
          return fallbackPolicy;
        }
        if (!fallbackPolicy || fallbackPolicy.classification !== "unknown") {
          fallbackPolicy = bus.dataPolicy?.classification === "unknown"
            ? bus.dataPolicy
            : classifyImportedDocument(bus.project.manifest?.documentId);
        }
        return fallbackPolicy;
      };
    })(),
    getScopeContext: options.getScopeContext || (() => options.scope || { kind: "document" }),
    getApplyMode: options.getApplyMode || (() => options.applyMode || "preview"),
  };
  const execute = (name, input = {}, humanApproval = false, sessionId = defaultSessionId) => {
    let parsed = input;
    if (typeof input === "string") {
      try { parsed = JSON.parse(input); }
      catch { return Promise.resolve(safeFailure("INVALID_INPUT_JSON")); }
    }
    return executeAgentCommand(bus, name, parsed, { ...gatewayOptions, sessionId, humanApproval });
  };
  const createSession = (sessionId, includeHumanApproval) => {
    const session = {
      contractVersion: AGENT_CONTRACT_VERSION,
      listTools: () => TOOL_CONTRACTS,
      execute: (name, input = {}) => execute(name, input, false, sessionId),
    };
    if (includeHumanApproval) {
      session.executeHuman = (name, input = {}) => {
        if (!HUMAN_APPROVAL_COMMANDS.has(name)) return Promise.resolve(safeFailure("HUMAN_APPROVAL_NOT_APPLICABLE"));
        return execute(name, input, true, sessionId);
      };
    }
    return Object.freeze(session);
  };
  const bindSession = (sessionId) => createSession(sessionId, false);
  const createUiSession = (sessionId) => createSession(sessionId, true);
  const gateway = Object.freeze({
    contractVersion: AGENT_CONTRACT_VERSION,
    listTools: () => TOOL_CONTRACTS,
    execute: (name, input = {}) => execute(name, input, false),
  });
  SESSION_BINDERS.set(gateway, bindSession);
  options.onUiSessionFactory?.(createUiSession);
  Object.defineProperty(globalScope, "PrintFormStudioAgent", { configurable: true, value: gateway });
  return gateway;
}

export function bindAgentSession(gateway, sessionId) {
  return SESSION_BINDERS.get(gateway)?.(String(sessionId)) || gateway;
}
