import { assertPolicyCurrent, isPolicyCurrent } from "./data-policy.js";
import { assertOperationsInScope, scopeFingerprint } from "./agent-scope.js";

const AUTO_APPLY_OPERATIONS = new Set(["set_column_widths", "set_font_scale", "set_brand_color"]);
const HUMAN_MUTATION_COMMANDS = new Set(["set_locale", "set_asset_source", "set_sample_scenario", "undo_revision"]);
const DOCUMENT_SCOPED_COMMANDS = new Set(["set_locale", "set_asset_source", "set_sample_scenario", "undo_revision"]);

export function isAutoApplyEligible(value) {
  const changes = Array.isArray(value) ? value : value?.operations || value?.changes || [];
  return Array.isArray(changes) && changes.length > 0
    && changes.every((operation) => operation && AUTO_APPLY_OPERATIONS.has(operation.type));
}

function failure(code, message) {
  return Object.assign(new Error(message), { code });
}

function assertCommandScope(name, context) {
  if (!context?.agent || context.legacy || !DOCUMENT_SCOPED_COMMANDS.has(name)) return;
  if (context.scope?.kind !== "document") throw failure("SCOPE_VIOLATION", "This command requires an explicit whole-document scope");
}

function assertCommandApplyPermission(name, context) {
  if (!context?.agent || context.legacy || !HUMAN_MUTATION_COMMANDS.has(name) || context.humanApproval) return;
  throw failure("HUMAN_APPROVAL_REQUIRED", "This direct document mutation requires explicit human approval");
}

export function assertContextCurrent(context) {
  if (!context?.agent) return;
  if (!context?.isCurrent?.()) throw failure("STALE_POLICY_CONTEXT", "The Agent context is no longer current");
  if (context.dataPolicy && context.currentPolicy) assertPolicyCurrent(context.dataPolicy, context.currentPolicy());
}

export function assertBusPolicyCurrent(bus, context) {
  if (!context?.agent || !context.dataPolicy || !bus?.dataPolicy) return;
  if (!isPolicyCurrent(context.dataPolicy, bus.dataPolicy)) {
    throw failure("STALE_POLICY_CONTEXT", "The Agent policy no longer matches the target document session");
  }
}

export function assertAgentOperations(bus, operations, context) {
  if (!context?.agent) return;
  assertContextCurrent(context);
  assertBusPolicyCurrent(bus, context);
  if (!Array.isArray(operations) || operations.length === 0) {
    throw failure("INVALID_OPERATION_SET", "Agent preview requires at least one operation");
  }
  assertOperationsInScope(bus.project, operations, context.scope);
  if (context.dataPolicy?.allowExternalAssetFetch === false) {
    const external = operations.find((operation) => operation.type === "set_asset_slot"
      && !String(operation.source || "").startsWith("data:"));
    if (external) throw failure("ASSET_FETCH_POLICY_BLOCKED", "External asset requests are blocked by the current data policy");
  }
}

export function bindTransactionContext(transaction, context) {
  if (!context?.agent) return transaction;
  transaction.agent_context = {
    contextId: context.dataPolicy?.contextId || null,
    generation: context.dataPolicy?.generation || null,
    classification: context.dataPolicy?.classification || null,
    documentId: context.dataPolicy?.documentId || null,
    sessionId: context.sessionId || null,
    scope: context.scope,
    scopeFingerprint: scopeFingerprint(context.scope),
  };
  return transaction;
}

export function assertTransactionContext(transaction, context) {
  if (!context?.agent || context.legacy) return;
  if (!transaction?.agent_context) throw failure("STALE_POLICY_CONTEXT", "The transaction has no trusted Agent context");
  assertContextCurrent(context);
  const expected = transaction.agent_context;
  if (expected.contextId && expected.contextId !== context.dataPolicy?.contextId) throw failure("STALE_POLICY_CONTEXT", "The transaction belongs to another Agent context");
  if (expected.generation && expected.generation !== context.dataPolicy?.generation) throw failure("STALE_POLICY_CONTEXT", "The transaction belongs to an older policy generation");
  if (expected.documentId !== context.dataPolicy?.documentId) throw failure("STALE_POLICY_CONTEXT", "The transaction belongs to another document");
  if (expected.sessionId && expected.sessionId !== context.sessionId) throw failure("STALE_POLICY_CONTEXT", "The transaction belongs to another Agent session");
  if (expected.scopeFingerprint !== scopeFingerprint(context.scope)) throw failure("SCOPE_CHANGED", "The active Agent scope changed after preview");
}

export function filterAgentTransactions(transactions, context) {
  if (!context?.agent || context.legacy) return transactions;
  return transactions.filter((transaction) => {
    const bound = transaction?.agent_context;
    return Boolean(bound)
      && bound.contextId === (context.dataPolicy?.contextId || null)
      && bound.generation === (context.dataPolicy?.generation || null)
      && bound.documentId === (context.dataPolicy?.documentId || null)
      && bound.sessionId === (context.sessionId || null);
  });
}

export function assertApplyPermission(transaction, context) {
  if (!context?.agent || context.humanApproval || context.legacy) return;
  if (context.applyMode === "preview") throw failure("HUMAN_APPROVAL_REQUIRED", "Preview mode requires an explicit human approval before apply");
  if (!isAutoApplyEligible(transaction)) {
    throw failure("AUTO_APPLY_NOT_ALLOWED", "This change requires explicit human approval");
  }
}

export function assertPolicyCommand(name, input, context, bus = null) {
  if (!context?.dataPolicy) return;
  assertContextCurrent(context);
  assertBusPolicyCurrent(bus, context);
  assertCommandScope(name, context);
  assertCommandApplyPermission(name, context);
  if (name === "capture_layout_evidence" && input?.visualMode === "pixels" && !context.dataPolicy.allowPixelEvidence) {
    throw failure("PIXEL_EVIDENCE_SYNTHETIC_ONLY", "Pixel evidence is available only for synthetic-data sessions");
  }
  if (name === "set_sample_scenario" && context.dataPolicy.classification !== "synthetic") {
    throw failure("SYNTHETIC_SCENARIO_REQUIRED", "Sample scenarios are available only in synthetic-data sessions");
  }
}
