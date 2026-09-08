import { classifyImportedDocument, classifyRealDocument, isPolicyCurrent } from "./data-policy.js";
import { normalizeScope } from "./agent-scope.js";

function randomPart() {
  return globalThis.crypto?.randomUUID?.()?.replaceAll("-", "")
    || Math.random().toString(36).slice(2, 14);
}

export function createAgentSessionId(prefix = "session") {
  return `${prefix}-${randomPart()}`;
}

export function createReferenceRegistry() {
  const rawToReference = new Map();
  const referenceToRaw = new Map();
  return {
    referenceFor(kind, value) {
      if (value == null) return null;
      const raw = String(value);
      const key = `${kind}:${raw}`;
      if (!rawToReference.has(key)) {
        const reference = `ref:${kind}:${randomPart()}`;
        rawToReference.set(key, reference);
        referenceToRaw.set(reference, raw);
      }
      return rawToReference.get(key);
    },
    resolve(kind, value) {
      if (value == null || typeof value !== "string") return value;
      if (!value.startsWith("ref:")) return value;
      const resolved = referenceToRaw.get(value);
      if (resolved == null) throw Object.assign(new Error("The reference is not valid in this Agent context"), { code: "REFERENCE_NOT_FOUND" });
      return resolved;
    },
  };
}

export function createPassthroughReferences() {
  return { referenceFor: (_kind, value) => value == null ? null : String(value), resolve: (_kind, value) => value };
}

const TARGET_KEYS = new Map([
  ["componentId", "component"], ["transactionId", "transaction"],
  ["leaseId", "lease"], ["evidenceId", "evidence"], ["evidenceIds", "evidence"], ["slot", "slot"],
  ["tableSelector", "table"], ["selector", "selector"], ["path", "path"], ["owner", "identity"], ["agentId", "identity"],
]);

function resolveValue(key, value, references) {
  const kind = TARGET_KEYS.get(key);
  if (!kind) return value;
  if (Array.isArray(value)) return value.map((item) => resolveValue(key, item, references));
  return references.resolve(kind, value);
}

export function resolveAgentInput(input, references) {
  if (!input || typeof input !== "object") return input;
  if (Array.isArray(input)) return input.map((item) => resolveAgentInput(item, references));
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [
    key,
    TARGET_KEYS.has(key) ? resolveValue(key, value, references) : resolveAgentInput(value, references),
  ]));
}

export function createAgentContext({
  dataPolicy = null,
  scope = { kind: "document" },
  applyMode = "preview",
  currentPolicy = null,
  sessionId = null,
  source = "agent",
  humanApproval = false,
  legacy = false,
  references = null,
} = {}) {
  return {
    agent: true,
    dataPolicy: dataPolicy || null,
    scope: normalizeScope(scope),
    applyMode: applyMode === "auto" ? "auto" : "preview",
    sessionId: sessionId == null ? null : String(sessionId),
    currentPolicy,
    source,
    humanApproval: Boolean(humanApproval),
    legacy: Boolean(legacy),
    strict: !legacy,
    references: references || createReferenceRegistry(),
    isCurrent() {
      if (!this.currentPolicy || !this.dataPolicy) return true;
      const current = this.currentPolicy();
      return Boolean(current) && (current === this.dataPolicy || isPolicyCurrent(this.dataPolicy, current));
    },
  };
}

export function defaultPolicyForOptions({ realData = false, dataPolicy = null } = {}) {
  return dataPolicy || (realData ? classifyRealDocument() : classifyImportedDocument());
}
