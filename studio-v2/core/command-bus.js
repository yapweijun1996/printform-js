import { AGENT_CONTRACT_VERSION, PROTOCOL_VERSION, STUDIO_VERSION } from "./constants.js";
import { validateProject } from "./acceptance.js";
import { RevisionHistory, revisionConflict } from "./history.js";
import { applyOperations, diffProjects, previewSourceEdit } from "./operations.js";
import { createScenario, SAMPLE_SCENARIOS } from "./sample-scenarios.js";
import { TOOL_CONTRACTS } from "./tool-contracts.js";
import { getAgentOperationCatalog } from "./operation-catalog.js";
import { inspectDesignState } from "./design-state.js";
import { PRINT_LOCALES } from "./i18n.js";
import { layoutReviewStatus, LAYOUT_REVIEW_CHECKLIST } from "./layout-review.js";
import { executeReviewCommand, REVIEW_COMMANDS } from "./command-bus-review.js";
import { attachRenderProvenance, hasRenderProvenance, hashRenderProject, provenanceError, verifyCurrentRender } from "./render-provenance.js";
import { sha256, stableStringify } from "./json.js";
import { getFormSpec, listComponents as listFormComponents, findComponent as findFormComponent } from "./form-spec.js";
import { TransactionJournal, journalKey } from "./transaction-journal.js";
import { DurableTransactionStore } from "./durable-transaction-store.js";
import { isLeaseManagedStatus, isTerminalStatus, transitionTransaction } from "./transaction-state.js";
import { mergeRenderReport } from "./render-report.js";
import { inspectTemplate } from "./template-inspection.js";
import {
  beginTransaction as beginTransactionService,
  requireTransaction as requireTransactionService,
  previewTransaction as previewTransactionService,
  approveTransaction as approveTransactionService,
  applyApprovedTransaction as applyApprovedTransactionService,
  rollbackTransaction as rollbackTransactionService,
  revisionComparison as revisionComparisonService,
  commitConvenienceTransaction as commitConvenienceTransactionService,
} from "./transaction-service.js";
import {
  renewLease as renewLeaseService,
  releaseLease as releaseLeaseService,
  takeoverTransaction as takeoverTransactionService,
  listActiveTransactions as listActiveTransactionsService,
  getTransaction as getTransactionService,
  recoverTransaction as recoverTransactionService,
  resolveConflict as resolveConflictService,
} from "./transaction-recovery-service.js";
// In-memory only — a memory-management knob, not a correctness dependency.
// Revision numbers are monotonic and never reused (history.js), so
// ensureRevision() already rejects any write against a base that has since
// moved on; a stale-but-still-cached candidate report can only ever be
// looked up by a hash computed from the CURRENT candidate content, so it
// can't be served against different content either.
const CANDIDATE_REPORT_TTL_MS = 5 * 60 * 1000;

export class CommandBus extends EventTarget {
  constructor(initialProject, {
    renderCandidate,
    transactionStorage = null,
    transactionStore = null,
    agentId = "studio-ui",
    owner = agentId,
    failureInjector = null,
    clock = () => new Date(),
    leaseDurationMs = 30 * 1000,
    hydrateDurable = true,
  } = {}) {
    super();
    const journal = journalKey(initialProject);
    this.transactionStore = transactionStore || new DurableTransactionStore({
      storage: transactionStorage,
      key: DurableTransactionStore.keyFor(journal),
      formId: DurableTransactionStore.formId(initialProject),
      initialProject,
      clock,
    });
    const durableProject = hydrateDurable ? this.transactionStore.getHeadProject() : null;
    const durableRevision = this.transactionStore.getHeadRevision();
    if (durableProject && durableRevision >= (Number.isInteger(initialProject?.revision) ? initialProject.revision : 0)) {
      initialProject = durableProject;
    }
    const initialRevision = Number.isInteger(initialProject?.revision)
      ? initialProject.revision
      : (Number.isInteger(initialProject?.attestation?.evidence?.revision) ? initialProject.attestation.evidence.revision : durableRevision);
    this.history = new RevisionHistory(initialProject, 50, initialRevision);
    if (hydrateDurable) {
      this.history.hydrate(this.transactionStore.listRevisions());
    }
    this.defaultSample = structuredClone(initialProject.sampleData);
    this.renderReport = null;
    this.reviewReceipt = null;
    this.reviewAttempts = 0;
    // Optional DOM-backed renderer injected by the UI layer (app.js), reusing
    // its one visible preview iframe. Unset in every non-browser context
    // (unit tests, the CLI validator) — preview_changes/apply_changes then
    // fall back to today's static-only validation, unchanged.
    this.renderCandidate = renderCandidate || null;
    this.candidateReports = new Map();
    // evidenceId -> Studio-issued layout evidence receipt for the CURRENT
    // revision. Cleared by every commit and undo alongside renderReport and
    // reviewReceipt: evidence describes one exact revision's layout, so any
    // mutation must invalidate it rather than let it vouch for new content.
    this.evidenceReceipts = new Map();
    this.agentId = agentId;
    this.owner = owner || agentId;
    this.clock = clock;
    this.failureInjector = failureInjector;
    this.leaseDurationMs = leaseDurationMs;
    this.transactionJournal = new TransactionJournal(transactionStorage, journal);
    this.transactions = new Map(this.transactionStore.listTransactions().map((transaction) => [transaction.transaction_id, transaction]));
    const persistedEvidence = this.transactionStore.getEvidencePack(this.revision)
      || this.transactionJournal.list().reverse().find((entry) => entry.type === "EVIDENCE_PACK" && entry.pack?.revision === this.revision)?.pack;
    this.evidencePack = persistedEvidence ? structuredClone(persistedEvidence) : null;
  }

  get project() { return this.history.project; }
  get revision() { return this.history.revision; }
  historyState() { return { revision: this.revision, canUndo: this.history.canUndo, canRedo: this.history.canRedo }; }

  beginTransaction(baseRevision = this.revision, agentId = this.agentId, owner = this.owner) {
    return beginTransactionService(this, baseRevision, agentId, owner);
  }

  requireTransaction(id) {
    return requireTransactionService(this, id);
  }

  transactionView(transaction) {
    return structuredClone(transaction);
  }

  persistTransaction(transaction) {
    const saved = this.transactionStore.saveTransaction(transaction);
    this.transactions.set(saved.transaction_id, saved);
    Object.assign(transaction, saved);
    return transaction;
  }

  refreshTransaction(id) {
    const transaction = this.transactionStore.getTransaction(id);
    if (transaction) this.transactions.set(id, transaction);
    return transaction || this.transactions.get(id) || null;
  }

  auditTransaction(type, transaction, details = {}) {
    return this.transactionStore.appendAudit({
      type,
      form_id: this.transactionStore.formId,
      transaction_id: transaction?.transaction_id || details.transaction_id || null,
      actor: details.actor || transaction?.owner || transaction?.agent_id || this.agentId,
      agent_id: transaction?.agent_id || this.agentId,
      revision: details.revision ?? transaction?.working_revision ?? this.revision,
      base_revision: transaction?.base_revision ?? null,
      base_project_hash: transaction?.base_project_hash || null,
      preview_hash: transaction?.preview_hash || null,
      candidate_content_hash: transaction?.candidate_content_hash || null,
      candidate_form_spec_hash: transaction?.candidate_form_spec_hash || null,
      form_spec_hash: details.form_spec_hash || null,
      ...details,
    });
  }

  maybeFail(phase) {
    if (!this.failureInjector) return;
    const shouldFail = typeof this.failureInjector === "function"
      ? this.failureInjector(phase)
      : this.failureInjector === phase || this.failureInjector?.[phase];
    if (!shouldFail) return;
    const failure = new Error(`Injected failure at ${phase}`);
    failure.code = "INJECTED_CRASH";
    failure.phase = phase;
    throw failure;
  }

  hasAtomicRevisionCas() {
    return this.transactionStore.atomic || Boolean(
      this.transactionStore.storage?.getItem
      && globalThis.navigator?.locks?.request,
    );
  }

  expireStaleTransactions(now = this.clock()) {
    const timestamp = new Date(now).getTime();
    const expired = [];
    for (const item of this.transactionStore.listActiveTransactions()) {
      if (!isLeaseManagedStatus(item.status) || !item.lease?.lease_expires_at) continue;
      if (new Date(item.lease.lease_expires_at).getTime() > timestamp) continue;
      const transaction = this.refreshTransaction(item.transaction_id);
      if (!transaction || isTerminalStatus(transaction.status)) continue;
      transitionTransaction(transaction, "expired");
      transaction.expired_at = new Date(timestamp).toISOString();
      transaction.lease = null;
      this.persistTransaction(transaction);
      this.auditTransaction("lease_expired", transaction, { reason: "lease_timeout" });
      this.transactionJournal.append({ type: "LEASE_EXPIRED", transaction_id: transaction.transaction_id, revision: this.revision, agent_id: transaction.agent_id });
      expired.push(this.transactionView(transaction));
    }
    return expired;
  }

  async previewTransaction(operations, expectedRevision, existingId = null) {
    return previewTransactionService(this, operations, expectedRevision, existingId);
  }

  approveTransaction(input) {
    return approveTransactionService(this, input);
  }

  async applyApprovedTransaction(input) {
    return applyApprovedTransactionService(this, input);
  }

  async ensurePublishTransaction() {
    const committed = this.transactionStore.listTransactions()
      .filter((transaction) => transaction.status === "committed" && transaction.working_revision === this.revision)
      .sort((left, right) => String(right.committed_at || right.updated_at).localeCompare(String(left.committed_at || left.updated_at)));
    if (committed[0]) return committed[0].transaction_id;

    // A document may be publishable at revision 0, before any content edit
    // exists. Create an auditable no-op transaction so Evidence Pack
    // anchoring never falls back to an unowned artifact.
    const preview = await this.previewTransaction([], this.revision);
    const transactionId = preview.transaction.transaction_id;
    const candidateHash = preview.transaction.preview_hash;
    this.approveTransaction({
      expectedRevision: this.revision,
      transactionId,
      expectedCandidateHash: candidateHash,
      requireValid: true,
    });
    const applied = await this.applyApprovedTransaction({
      expectedRevision: this.revision,
      transactionId,
      expectedCandidateHash: candidateHash,
      requireValid: true,
      reason: "publish evidence anchor",
    });
    return applied.transaction.transaction_id;
  }

  rollbackTransaction(id) {
    return rollbackTransactionService(this, id);
  }

  renewLease(input) { return renewLeaseService(this, input); }
  releaseLease(input) { return releaseLeaseService(this, input); }
  takeoverTransaction(input) { return takeoverTransactionService(this, input); }
  listActiveTransactions() { return listActiveTransactionsService(this); }
  getTransaction(id) { return getTransactionService(this, id); }
  recoverTransaction(input) { return recoverTransactionService(this, input); }
  resolveConflict(input) { return resolveConflictService(this, input); }

  revisionComparison(fromRevision, toRevision) {
    return revisionComparisonService(this, fromRevision, toRevision);
  }

  async commitConvenienceTransaction(operations, expectedRevision, reason) {
    return commitConvenienceTransactionService(this, operations, expectedRevision, reason);
  }

  ensureRevision(expected) {
    const durableRevision = this.transactionStore.getHeadRevision();
    const actual = Math.max(this.revision, durableRevision);
    if (expected !== actual) throw revisionConflict(expected, actual);
  }

  validation(project = this.project) {
    const base = validateProject(project);
    if (project !== this.project) return base;
    return mergeRenderReport(base, this.renderReport);
  }

  recordRenderReport(report, provenance = null) {
    this.renderReport = provenance ? attachRenderProvenance(report, provenance) : structuredClone(report);
  }

  // Real pagination for a not-yet-committed candidate, cached by content
  // hash so a preview_changes immediately followed by the identical
  // apply_changes doesn't pay for a second render. Returns null (not a
  // rejected promise) when no renderer is available, so callers can treat
  // "no real report" as a plain fallback rather than an error path.
  async getCandidateReport(candidate, revision, scenario = null, renderOptions = {}) {
    if (!this.renderCandidate) return null;
    const hash = await sha256(stableStringify(candidate));
    const visualMode = renderOptions.visualMode === "pixels" ? "pixels" : "geometry";
    const cacheKey = `${hash}:${visualMode}`;
    const baseProjectHash = await hashRenderProject(this.project);
    const provenance = { revision, candidateHash: hash, baseProjectHash, source: "candidate", scenario, visualMode };
    const now = Date.now();
    const cached = this.candidateReports.get(cacheKey);
    if (cached && cached.expiresAt > now) return { hash, report: attachRenderProvenance(cached.report, provenance) };
    let report;
    try {
      report = await this.renderCandidate(candidate, revision, { ...renderOptions, visualMode, allowSyntheticPixels: visualMode === "pixels" });
    } catch (error) {
      report = { status: "blocked", validation: { valid: false, errors: [{ code: "RENDER_FAILED", path: "/", message: error?.message || "Candidate render failed" }], warnings: [] }, issues: [], metrics: {} };
    }
    this.candidateReports.set(cacheKey, { report, expiresAt: now + CANDIDATE_REPORT_TTL_MS });
    for (const [key, entry] of this.candidateReports) {
      if (entry.expiresAt <= now) this.candidateReports.delete(key);
    }
    return { hash, report: attachRenderProvenance(report, provenance) };
  }

  readiness() {
    const base = this.validation();
    const pending = [];
    if (!this.renderReport) pending.push({ code: "PREVIEW_REQUIRED", message: "A current browser layout report is required before production export", path: "/", severity: "error" });
    else if (!hasRenderProvenance(this.renderReport, "committed") || this.renderReport.provenance.revision !== this.revision) pending.push({ code: "RENDER_PROVENANCE_REQUIRED", message: "The current render must be issued for this committed revision", path: "/renderReport", severity: "error" });
    const review = layoutReviewStatus(this.reviewReceipt, this.revision);
    if (review.status !== "pass") pending.push({ code: "LAYOUT_REVIEW_REQUIRED", message: "A current AI full-page UI/UX review is required before production export", path: "/review", severity: "error" });
    return { ...base, valid: base.valid && !pending.length, productionValid: base.productionValid && !pending.length, errors: [...base.errors, ...pending], reviewReceipt: review.status === "pass" ? this.reviewReceipt : null };
  }

  preview(operations, expectedRevision) {
    this.ensureRevision(expectedRevision);
    const candidate = applyOperations(this.project, operations);
    return { revision: this.revision, diff: diffProjects(this.project, candidate), validation: this.validation(candidate), candidate };
  }

  commit(candidate, reason, options = {}) {
    const commitNow = () => this.commitNow(candidate, reason, options);
    if (this.transactionStore.atomic || !this.transactionStore.storage?.getItem || !globalThis.navigator?.locks?.request) return commitNow();
    return globalThis.navigator.locks.request(
      `printform-studio-v2:${this.transactionStore.formId}`,
      { mode: "exclusive" },
      commitNow,
    );
  }

  commitNow(candidate, reason, { expectedRevision = this.revision, expectedProjectHash = null, transactionId = null, candidateHash = null } = {}) {
    const storedCandidate = structuredClone(candidate);
    const nextRevision = expectedRevision + 1;
    storedCandidate.revision = nextRevision;
    const cas = this.transactionStore.compareAndSwapHead({
      expectedRevision,
      expectedProjectHash,
      nextProject: storedCandidate,
      nextProjectHash: candidateHash,
      transactionId,
      reason,
    });
    if (!cas.ok) throw revisionConflict(expectedRevision, cas.actualRevision);
    this.renderReport = null;
    this.reviewReceipt = null;
    this.reviewAttempts = 0;
    this.evidenceReceipts.clear();
    this.evidencePack = null;
    const revision = this.history.commit(candidate, reason);
    if (revision !== cas.revision) throw Object.assign(new Error("Local revision diverged from durable commit"), { code: "RECOVERY_REQUIRED", expectedRevision: cas.revision, actualRevision: revision });
    this.history.project.revision = revision;
    this.transactionJournal.append({ type: "REVISION_COMMIT", revision, reason, agent_id: this.agentId });
    this.dispatchEvent(new CustomEvent("change", { detail: { revision, project: candidate, reason } }));
    return revision;
  }

  recordEvidencePack(pack) {
    if (!pack || pack.revision !== this.revision) throw Object.assign(new Error("Evidence pack revision does not match the current draft"), { code: "EVIDENCE_REVISION_MISMATCH" });
    this.maybeFail("during_evidence_write");
    const transactionId = pack.transactionId || this.transactionStore.head.transaction_id;
    const transaction = transactionId ? this.transactionStore.getTransaction(transactionId) : null;
    if (transaction?.preview_hash && pack.previewHash && transaction.preview_hash !== pack.previewHash) {
      throw Object.assign(new Error("Evidence pack preview hash does not match the approved transaction"), { code: "EVIDENCE_PREVIEW_MISMATCH" });
    }
    if (transaction?.candidate_form_spec_hash && pack.formSpecHash && transaction.candidate_form_spec_hash !== pack.formSpecHash) {
      throw Object.assign(new Error("Evidence pack FormSpec hash does not match the approved transaction"), { code: "EVIDENCE_FORMSPEC_MISMATCH" });
    }
    const anchor = this.transactionStore.anchorEvidence({ transactionId, pack, actor: this.owner || this.agentId });
    this.evidencePack = structuredClone(pack);
    this.transactionJournal.append({ type: "EVIDENCE_PACK", revision: this.revision, pack: this.evidencePack });
    this.transactionJournal.append({ type: "EVIDENCE_ANCHORED", revision: this.revision, transaction_id: anchor.transaction_id, evidence_pack_hash: anchor.evidence_pack_hash, artifact_hash: anchor.artifact_hash });
    const saved = this.transactionStore.getTransaction(anchor.transaction_id);
    if (saved) this.transactions.set(anchor.transaction_id, saved);
    return structuredClone(this.evidencePack);
  }

  async execute(name, input = {}) {
    try {
      if (name === "get_capabilities") {
        // candidateHash: the field is always present on preview_changes/
        // apply_changes responses (contract shape). candidateRealRender:
        // whether THIS session can actually back it with real pagination —
        // false in a DOM-less context (CLI validator, unit tests), where
        // both tools fall back to schema-only validation and candidateHash
        // is always null. Additive to 1.1.0, so no existing caller breaks.
        // layoutEvidenceReceipts also needs a real renderer: without one,
        // capture_layout_evidence fails closed and no review can ever pass.
        const capabilities = {
          candidateHash: true,
          candidateRealRender: Boolean(this.renderCandidate),
          layoutEvidenceReceipts: Boolean(this.renderCandidate),
          formSpec: true,
          transactions: true,
          persistentAudit: this.transactionStore.persistent,
          durableTransactions: this.transactionStore.persistent,
          atomicRevisionCas: this.hasAtomicRevisionCas(),
          leaseRecovery: true,
        };
        return this.success({ protocolVersion: PROTOCOL_VERSION, contractVersion: AGENT_CONTRACT_VERSION, studioVersion: STUDIO_VERSION, capabilities, tools: TOOL_CONTRACTS, sampleScenarios: SAMPLE_SCENARIOS, locales: PRINT_LOCALES, humanExportRequired: true, completionPolicy: "AI layout review must pass for the current revision before request_export can be ready" });
      }
      if (name === "get_project_summary") return this.success({ revision: this.revision, title: this.project.manifest.title, locale: this.project.manifest.locale, trust: this.project.trust, protocolVersion: this.project.manifest.protocolVersion, review: layoutReviewStatus(this.reviewReceipt, this.revision), validation: this.validation() });
      if (name === "inspect_document") return this.success({ revision: this.revision, ...inspectTemplate(this.project.templateHtml) });
      if (name === "get_form_spec") return this.success({ revision: this.revision, spec: getFormSpec(this.project) });
      if (name === "list_components") return this.success({ revision: this.revision, components: listFormComponents(this.project) });
      if (name === "get_component") return this.success({ revision: this.revision, component: findFormComponent(this.project, input.componentId) });
      if (name === "inspect_design_state") return this.success(inspectDesignState({ ...this.project, revision: this.revision }));
      if (name === "get_operation_catalog") return this.success({ revision: this.revision, operations: getAgentOperationCatalog() });
      if (name === "validate_project") return this.success({ revision: this.revision, validation: this.validation() });
      if (name === "get_layout_review_status") return this.success({ revision: this.revision, review: layoutReviewStatus(this.reviewReceipt, this.revision), checklist: LAYOUT_REVIEW_CHECKLIST });
      if (REVIEW_COMMANDS.has(name)) return this.success(await executeReviewCommand(this, name, input));
      if (name === "begin_transaction") return this.success(this.beginTransaction(input.baseRevision ?? this.revision, input.agentId, input.owner));
      if (name === "get_transaction") return this.success({ transaction: this.getTransaction(input.transactionId) });
      if (name === "list_active_transactions") return this.success({ transactions: this.listActiveTransactions() });
      if (name === "renew_lease") return this.success(this.renewLease(input));
      if (name === "release_lease") return this.success(this.releaseLease(input));
      if (name === "takeover_transaction") return this.success(this.takeoverTransaction(input));
      if (name === "recover_transaction") return this.success(this.recoverTransaction(input));
      if (name === "resolve_conflict") return this.success(this.resolveConflict(input));
      if (name === "get_revision") return this.success(this.transactionStore.getRevision());
      if (name === "get_audit_events") return this.success({ events: this.transactionStore.listAuditEvents() });
      if (name === "preview_changes") {
        const result = await this.previewTransaction(input.operations, input.expectedRevision, input.transactionId);
        return this.success({ revision: result.preview.revision, transactionId: result.transaction.transaction_id, diff: result.preview.diff, validation: result.validation, candidateHash: result.transaction.preview_hash });
      }
      if (name === "approve_transaction") {
        return this.success(this.approveTransaction(input));
      }
      if (name === "apply_changes") {
        if (!input.transactionId) throw Object.assign(new Error("apply_changes requires an approved transaction"), { code: "TRANSACTION_REQUIRED" });
        return this.success(await this.applyApprovedTransaction(input));
      }
      if (name === "rollback_transaction") {
        return this.success(this.rollbackTransaction(input.transactionId));
      }
      if (name === "compare_revision") {
        return this.success(this.revisionComparison(input.fromRevision, input.toRevision));
      }
      if (name === "get_transaction_history") return this.success({ revision: this.revision, entries: this.transactionJournal.list(), transactions: this.transactionStore.listTransactions(), auditEvents: this.transactionStore.listAuditEvents() });
      if (name === "get_evidence_pack") return this.success({ revision: this.revision, evidencePack: structuredClone(this.transactionStore.getEvidencePack(this.revision) || this.evidencePack), anchor: this.transactionStore.getEvidenceAnchor(this.revision) });
      if (name === "preview_source_edit") {
        this.ensureRevision(input.expectedRevision);
        const candidate = previewSourceEdit(this.project, input.section, input.content);
        return this.success({ revision: this.revision, diff: diffProjects(this.project, candidate), validation: this.validation(candidate) });
      }
      if (name === "set_sample_scenario") {
        const result = await this.commitConvenienceTransaction(
          [{ type: "replace_sample_data", value: createScenario(this.defaultSample, input.scenario) }],
          input.expectedRevision,
          `sample scenario: ${input.scenario}`,
        );
        return this.success(result);
      }
      if (name === "set_locale") {
        if (!PRINT_LOCALES.includes(input.locale)) throw Object.assign(new Error(`Unsupported locale: ${input.locale}`), { code: "LOCALE_UNSUPPORTED" });
        const result = await this.commitConvenienceTransaction(
          [{ type: "set_manifest_value", path: "/locale", value: input.locale }],
          input.expectedRevision,
          `locale: ${input.locale}`,
        );
        return this.success({ ...result, locale: input.locale });
      }
      if (name === "set_asset_source") {
        const result = await this.commitConvenienceTransaction(
          [{ type: "set_asset_slot", slot: input.slot, source: input.source }],
          input.expectedRevision,
          `asset slot: ${input.slot}`,
        );
        return this.success({ ...result, slot: input.slot });
      }
      if (name === "undo_revision") {
        const result = this.history.undo(input.expectedRevision);
        if (result.changed) {
          this.renderReport = null;
          this.reviewReceipt = null;
          this.reviewAttempts = 0;
          this.evidenceReceipts.clear();
          this.evidencePack = null;
          this.transactionJournal.append({ type: "UNDO", revision: result.revision, agent_id: this.agentId });
          this.dispatchEvent(new CustomEvent("change", { detail: { revision: result.revision, project: result.project, reason: "undo" } }));
        }
        return this.success(result);
      }
      if (name === "redo_revision") {
        const result = this.history.redo(input.expectedRevision);
        if (result.changed) {
          this.renderReport = null;
          this.reviewReceipt = null;
          this.reviewAttempts = 0;
          this.evidenceReceipts.clear();
          this.evidencePack = null;
          this.transactionJournal.append({ type: "REDO", revision: result.revision, agent_id: this.agentId });
          this.dispatchEvent(new CustomEvent("change", { detail: { revision: result.revision, project: result.project, reason: "redo" } }));
        }
        return this.success(result);
      }
      if (name === "request_export") {
        const validation = this.readiness();
        if (this.renderReport?.status === "ready") {
          const currentRender = await verifyCurrentRender(this.renderReport, this.project, this.revision);
          if (!currentRender.ok && !validation.errors.some((item) => item.code === currentRender.code)) {
            validation.valid = false; validation.productionValid = false; validation.errors.push(provenanceError(currentRender));
          }
        }
        return this.success({ revision: this.revision, ready: validation.productionValid, validation, requiresUserConfirmation: true });
      }
      throw Object.assign(new Error(`Unknown tool: ${name}`), { code: "UNKNOWN_TOOL" });
    } catch (error) {
      return { ok: false, error: { code: error.code || "COMMAND_FAILED", message: error.message, expectedRevision: error.expectedRevision, actualRevision: error.actualRevision, expectedCandidateHash: error.expectedCandidateHash, actualCandidateHash: error.actualCandidateHash, transactionId: error.transactionId, owner: error.owner, leaseId: error.leaseId, phase: error.phase, validation: error.validation } };
    }
  }

  success(result) { return { ok: true, result }; }
}
