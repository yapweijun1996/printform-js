export const DATA_CLASSIFICATIONS = Object.freeze({
  UNKNOWN: "unknown",
  SYNTHETIC: "synthetic",
  REAL: "real",
});

const CLASSIFICATIONS = new Set(Object.values(DATA_CLASSIFICATIONS));

function contextId() {
  return globalThis.crypto?.randomUUID?.()
    || `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeClassification(value) {
  const normalized = String(value || DATA_CLASSIFICATIONS.UNKNOWN).toLowerCase();
  return CLASSIFICATIONS.has(normalized) ? normalized : DATA_CLASSIFICATIONS.UNKNOWN;
}

export function createDataPolicy({
  classification = DATA_CLASSIFICATIONS.UNKNOWN,
  documentId = null,
  context = null,
  generation = 1,
} = {}) {
  const kind = normalizeClassification(classification);
  const synthetic = kind === DATA_CLASSIFICATIONS.SYNTHETIC;
  return Object.freeze({
    classification: kind,
    documentId: documentId == null ? null : String(documentId),
    contextId: context || contextId(),
    generation: Number.isSafeInteger(generation) && generation > 0 ? generation : 1,
    allowDurable: synthetic,
    allowRecovery: synthetic,
    allowPersistentSessions: synthetic,
    allowExternalAssetFetch: synthetic,
    allowPixelEvidence: synthetic,
    allowProviderDocumentContext: synthetic,
  });
}

export function classifySampleDocument(documentId = null) {
  return createDataPolicy({ classification: DATA_CLASSIFICATIONS.SYNTHETIC, documentId });
}

export function classifyImportedDocument(documentId = null) {
  return createDataPolicy({ classification: DATA_CLASSIFICATIONS.UNKNOWN, documentId });
}

export function classifySyntheticDocument(documentId = null) {
  return classifySampleDocument(documentId);
}

export function classifyRealDocument(documentId = null) {
  return createDataPolicy({ classification: DATA_CLASSIFICATIONS.REAL, documentId });
}

export function nextDataPolicy(policy, classification = policy?.classification) {
  return createDataPolicy({
    classification,
    documentId: policy?.documentId,
    generation: (Number(policy?.generation) || 0) + 1,
  });
}

export function isPolicyCurrent(expected, current) {
  if (!expected && !current) return true;
  if (!expected || !current) return false;
  return expected.contextId === current.contextId
    && expected.generation === current.generation
    && expected.classification === current.classification
    && expected.documentId === current.documentId;
}

export function policyError(code = "POLICY_RESTRICTED") {
  return Object.assign(new Error("The current data policy does not allow this operation"), { code });
}

export function assertPolicyCurrent(expected, current) {
  if (!isPolicyCurrent(expected, current)) throw policyError("STALE_POLICY_CONTEXT");
}

export function policyAllows(policy, capability) {
  return Boolean(policy?.[`allow${capability[0].toUpperCase()}${capability.slice(1)}`]);
}
