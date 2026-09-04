import { validateProject } from "./acceptance.js";
import { RevisionHistory, revisionConflict } from "./history.js";
import { applyOperations, diffProjects } from "./operations.js";
import { layoutReviewStatus } from "./layout-review.js";
import { attachRenderProvenance, hasRenderProvenance, hashRenderProject, provenanceError, verifyCurrentRender } from "./render-provenance.js";
import { sha256, stableStringify } from "./json.js";
import { TransactionJournal, journalKey } from "./transaction-journal.js";
import { DurableTransactionStore } from "./durable-transaction-store.js";
import { mergeRenderReport } from "./render-report.js";
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
import { dispatchCommand } from "./command-bus-dispatch.js";
import {
  expireStaleTransactions as expireStaleTransactionsService,
  ensurePublishTransaction as ensurePublishTransactionService,
  recordEvidencePack as recordEvidencePackService
} from "./command-bus-evidence.js";

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

  beginTransaction(baseRevision = this.revision, agentId = this.agentId, owner = this.owner) { return beginTransactionService(this, baseRevision, agentId, owner); }
  requireTransaction(id) { return requireTransactionService(this, id); }
  transactionView(transaction) { return structuredClone(transaction); }
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
    return expireStaleTransactionsService(this, now);
  }

  async previewTransaction(operations, expectedRevision, existingId = null) { return previewTransactionService(this, operations, expectedRevision, existingId); }
  approveTransaction(input) { return approveTransactionService(this, input); }
  async applyApprovedTransaction(input) { return applyApprovedTransactionService(this, input); }
  async ensurePublishTransaction() { return ensurePublishTransactionService(this); }
  rollbackTransaction(id) { return rollbackTransactionService(this, id); }

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
    return recordEvidencePackService(this, pack);
  }

  async execute(name, input = {}) {
    return dispatchCommand(this, name, input);
  }

  success(result) { return { ok: true, result }; }
}
