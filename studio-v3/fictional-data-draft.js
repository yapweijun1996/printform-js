import { jsonEqual } from '../document-core/core/json.js';
import { protectedBindings } from './agent-binding-invariants.js';
import { DATA_TYPES, validateDataset } from './database-model.js';
import { dataSource } from './data-provenance.js';
import { sampleData } from './model.js';
import { bindingValidation } from './validation.js';

const drafts = new WeakMap();
const NOTE_POINTER = '/notes';
const MAX_NOTE_LENGTH = 10000;

function reject(code) {
  throw Object.assign(new Error(code),{code});
}

function assertFictionalSource(project,dataPolicy) {
  const {manifest,sampleData:current,studioV3Session:session} = project;
  const type = manifest.studioV3?.type;
  const source = dataSource('builtin-demo');
  if ((dataPolicy?.classification !== undefined && dataPolicy.classification !== 'synthetic') ||
      !DATA_TYPES.includes(type) || manifest.datasetSchema != null || manifest.localImport != null ||
      session?.sample !== 'erp' || session.database !== null ||
      !jsonEqual(session.source,source) || !jsonEqual(session.erpSource,source)) {
    reject('DATA_DRAFT_SOURCE_DENIED');
  }
  // A label or saved dataset origin is insufficient. Match the local
  // fictional starter data and its current source snapshot.
  const starter = sampleData(type);
  if (!jsonEqual(starter,current) || !jsonEqual(starter,session.erpData)) reject('DATA_DRAFT_SOURCE_DENIED');
}

// Host-only staging. No caller gains provider disclosure or persistence rights
// by holding a ticket. The host must obtain a fresh explicit confirmation for
// the selected field and value before calling this function.
export function stageFictionalDataDraft(bus,{confirmed,documentId,revision,pointer,value} = {}) {
  const project = bus?.project;
  if (confirmed !== true) reject('DATA_DRAFT_APPROVAL_REQUIRED');
  if (!bus?.active || typeof documentId !== 'string' || !documentId ||
      !Number.isSafeInteger(revision) || revision < 0 || bus.revision !== revision ||
      project?.manifest?.documentId !== documentId) reject('DATA_DRAFT_STALE');
  assertFictionalSource(project,bus.dataPolicy);
  const design = project.manifest.studioV3;
  if (pointer !== NOTE_POINTER || !Object.hasOwn(project.sampleData,'notes') ||
      protectedBindings(design).some(binding=>binding.pointer === pointer)) reject('DATA_DRAFT_FIELD_DENIED');
  const previous = project.sampleData.notes;
  if (typeof previous !== 'string' || typeof value !== 'string' || value.length > MAX_NOTE_LENGTH) reject('DATA_DRAFT_VALUE_INVALID');
  if (value === previous) reject('DATA_DRAFT_NO_CHANGES');

  const baseline = structuredClone(project);
  const candidate = structuredClone(baseline);
  candidate.sampleData = validateDataset({...candidate.sampleData,notes:value});
  candidate.studioV3Session.erpData = structuredClone(candidate.sampleData);
  if (!bindingValidation(candidate).valid) reject('DATA_DRAFT_VALIDATION_FAILED');
  const ticket = Object.freeze({kind:'fictional-data-draft'});
  drafts.set(ticket,{bus,revision,baseline,policy:structuredClone(bus.dataPolicy),candidate});
  return ticket;
}

// Nothing serializable grants access. A stale ticket cannot be recovered
// even if a later action restores the original values.
export function reviewFictionalDataDraft(bus,ticket) {
  const state = drafts.get(ticket);
  if (!state || bus !== state.bus) reject('DATA_DRAFT_STALE');
  if (!bus.active || bus.revision !== state.revision ||
      !jsonEqual(state.baseline,bus.project) || !jsonEqual(state.policy,bus.dataPolicy)) {
    revokeFictionalDataDraft(ticket);
    reject('DATA_DRAFT_STALE');
  }
  return structuredClone(state.candidate);
}

export function revokeFictionalDataDraft(ticket) {
  drafts.delete(ticket);
}
