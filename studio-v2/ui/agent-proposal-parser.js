import { AGENT_OPERATION_DEFINITIONS } from "../core/operation-schemas.js";
import { validateData } from "../core/schema.js";

const MAX_TEXT_CHARS = 20000;
const MAX_JSON_CANDIDATES = 64;
const MAX_OPERATIONS = Object.keys(AGENT_OPERATION_DEFINITIONS).length;
const RECOVERABLE_RISKS = new Set(["low", "medium"]);
const PROPOSAL_CUE = /\b(?:semantic\s+)?(?:proposal|operation(?:s)?|proposed\s+changes?)\b|\bpreview\b/i;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readJsonValues(text) {
  const source = String(text || "").slice(0, MAX_TEXT_CHARS);
  const values = [];
  for (let start = 0; start < source.length && values.length < MAX_JSON_CANDIDATES; start += 1) {
    if (source[start] !== "{" && source[start] !== "[") continue;
    const opening = source[start];
    const closing = opening === "{" ? "}" : "]";
    let depth = 0;
    let quoted = false;
    let escaped = false;
    for (let cursor = start; cursor < source.length; cursor += 1) {
      const character = source[cursor];
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') quoted = false;
        continue;
      }
      if (character === '"') {
        quoted = true;
        continue;
      }
      if (character === opening) depth += 1;
      if (character === closing) depth -= 1;
      if (depth !== 0) continue;
      try {
        values.push(JSON.parse(source.slice(start, cursor + 1)));
        start = cursor;
      } catch { /* A nested or non-JSON brace is not a proposal. */ }
      break;
    }
  }
  return values;
}

function parseOperation(value) {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); }
  catch { return null; }
}

function operationList(value) {
  if (Array.isArray(value)) return value;
  if (!isObject(value)) return null;
  if (Array.isArray(value.operations)) return value.operations;
  if (Array.isArray(value.proposal?.operations)) return value.proposal.operations;
  if (Array.isArray(value.candidate?.operations)) return value.candidate.operations;
  if (Array.isArray(value.operation)) return value.operation;
  if (typeof value.type === "string") return [value];
  if (isObject(value.proposal) && typeof value.proposal.type === "string") return [value.proposal];
  if (isObject(value.candidate) && typeof value.candidate.type === "string") return [value.candidate];
  return null;
}

function expectedRevision(value) {
  const candidates = [value, value?.proposal, value?.candidate];
  return candidates.find((item) => Number.isInteger(item?.expectedRevision) && item.expectedRevision >= 0)?.expectedRevision;
}

function validateOperations(values, allowHighRisk) {
  if (!Array.isArray(values) || values.length === 0 || values.length > MAX_OPERATIONS) return null;
  const operations = values.map(parseOperation);
  if (operations.some((operation) => !isObject(operation))) return null;
  for (const operation of operations) {
    const definition = AGENT_OPERATION_DEFINITIONS[operation.type];
    if (!definition || (!allowHighRisk && !RECOVERABLE_RISKS.has(definition.risk))) return null;
    if (!validateData(definition.schema, operation).valid) return null;
  }
  return operations.map((operation) => structuredClone(operation));
}

function proposalFromValue(value, allowHighRisk) {
  const operations = validateOperations(operationList(value), allowHighRisk);
  return operations ? { operations, ...(expectedRevision(value) !== undefined ? { expectedRevision: expectedRevision(value) } : {}) } : null;
}

function standaloneProposal(text, allowHighRisk) {
  const source = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  if (!source) return null;
  try { return proposalFromValue(JSON.parse(source), allowHighRisk); }
  catch { return null; }
}

/**
 * Recover only an unambiguous semantic operation from a provider's final text.
 * The result is still sent through gateway preview/apply guards by the caller.
 * High-risk raw replacement operations are intentionally excluded by default.
 */
export function parseTextProposal(text, { allowHighRisk = false } = {}) {
  const standalone = standaloneProposal(text, allowHighRisk);
  if (standalone) return standalone;
  if (!PROPOSAL_CUE.test(String(text || "").slice(0, MAX_TEXT_CHARS))) return null;
  for (const value of readJsonValues(text)) {
    const proposal = proposalFromValue(value, allowHighRisk);
    if (proposal) return proposal;
  }
  return null;
}

export const TEXT_PROPOSAL_LIMITS = Object.freeze({
  maxTextChars: MAX_TEXT_CHARS,
  maxJsonCandidates: MAX_JSON_CANDIDATES,
  maxOperations: MAX_OPERATIONS
});
