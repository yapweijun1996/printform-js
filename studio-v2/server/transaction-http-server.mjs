import http from "node:http";
import { URL } from "node:url";
import { JSDOM } from "jsdom";
import { CommandBus } from "../core/command-bus.js";
import { DurableTransactionStore } from "../core/durable-transaction-store.js";
import { SqliteDurableBackend } from "./sqlite-durable-backend.mjs";

const SERVER_COMMANDS = new Set([
  "get_capabilities", "get_project_summary", "get_form_spec", "list_components",
  "get_component", "inspect_design_state", "validate_project", "get_revision",
  "get_transaction", "list_active_transactions", "get_audit_events",
  "get_transaction_history", "get_evidence_pack", "begin_transaction",
  "preview_changes", "approve_transaction", "apply_changes", "rollback_transaction",
  "renew_lease", "release_lease", "takeover_transaction", "recover_transaction",
  "resolve_conflict", "compare_revision", "request_export",
]);

function jsonResponse(response, status, body, origin = null) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
  });
  response.end(payload);
}

async function readJson(request, limit = 8 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error("Request body is too large"), { code: "REQUEST_TOO_LARGE" });
    chunks.push(chunk);
  }
  if (!size) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch (error) { throw Object.assign(new Error(`Invalid JSON: ${error.message}`), { code: "INVALID_JSON" }); }
}

function statusForError(error) {
  if (["REVISION_CONFLICT", "STORE_CONFLICT", "TRANSACTION_RECORD_CONFLICT", "LEASE_EXPIRED", "LEASE_OWNER_MISMATCH", "LEASE_ID_MISMATCH", "COMMIT_IN_PROGRESS", "EVIDENCE_ANCHOR_CONFLICT"].includes(error.code)) return 409;
  if (["SERVER_UNAVAILABLE", "RECOVERY_REQUIRED"].includes(error.code)) return 503;
  return 400;
}

export class TransactionHttpServer {
  constructor({
    dbPath,
    formId,
    initialProject,
    host = "127.0.0.1",
    port = 0,
    leaseDurationMs = 30 * 1000,
    serverToken = process.env.PRINTFORM_TRANSACTION_SERVER_TOKEN || "",
    allowedOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"],
    onCrash = null,
    testMode = false,
  } = {}) {
    if (!dbPath || !formId || !initialProject) throw new TypeError("TransactionHttpServer requires dbPath, formId and initialProject");
    this.dbPath = dbPath;
    this.formId = formId;
    this.initialProject = structuredClone(initialProject);
    this.host = host;
    this.port = port;
    this.leaseDurationMs = leaseDurationMs;
    this.serverToken = serverToken;
    this.allowedOrigins = new Set(allowedOrigins);
    this.onCrash = onCrash;
    this.testMode = testMode;
    this.backend = new SqliteDurableBackend({ filename: dbPath });
    this.key = `printform:server:${formId}`;
    this.httpServer = null;
    this.#ensureDomRuntime();
  }

  async start() {
    await this.#recoverPendingTransactions();
    this.httpServer = http.createServer((request, response) => {
      this.#handle(request, response).catch((error) => {
        console.error(`[printform-transaction-server] request failure: ${error.code || "SERVER_ERROR"}: ${error.message}`);
        try { this.#fail(request, response, error); }
        catch (failure) { console.error(`[printform-transaction-server] response failure: ${failure.message}`); response.destroy(); }
      });
    });
    return new Promise((resolve, reject) => {
      const onError = (error) => { this.httpServer.off("listening", onListening); reject(error); };
      const onListening = () => {
        this.httpServer.off("error", onError);
        const address = this.httpServer.address();
        resolve({ host: this.host, port: address.port, url: `http://${this.host}:${address.port}` });
      };
      this.httpServer.once("error", onError);
      this.httpServer.once("listening", onListening);
      this.httpServer.listen(this.port, this.host);
    });
  }

  async close() {
    if (this.httpServer) await new Promise((resolve) => this.httpServer.close(() => resolve()));
    this.httpServer = null;
    this.backend.close();
  }

  #origin(request) {
    const origin = request.headers.origin;
    return this.allowedOrigins.has(origin) ? origin : null;
  }

  #ensureDomRuntime() {
    if (typeof globalThis.document !== "undefined" && typeof globalThis.DOMParser !== "undefined") return;
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    globalThis.document = dom.window.document;
    globalThis.DOMParser = dom.window.DOMParser;
  }

  #authorize(request) {
    if (!this.serverToken) return;
    const bearer = String(request.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const supplied = request.headers["x-printform-server-token"] || bearer;
    if (supplied !== this.serverToken) throw Object.assign(new Error("Server authentication failed"), { code: "UNAUTHORIZED", status: 401 });
  }

  #store() {
    return new DurableTransactionStore({
      backend: this.backend,
      key: this.key,
      formId: this.formId,
      initialProject: this.initialProject,
      clock: () => this.backend.serverNow(),
    });
  }

  #bus(request, failurePhase = null) {
    const owner = String(request.headers["x-printform-owner"] || "anonymous");
    const agentId = String(request.headers["x-printform-agent-id"] || owner);
    const store = this.#store();
    return new CommandBus(this.initialProject, {
      transactionStore: store,
      owner,
      agentId,
      clock: () => this.backend.serverNow(),
      leaseDurationMs: this.leaseDurationMs,
      failureInjector: (phase) => phase === failurePhase,
    });
  }

  async #recoverPendingTransactions() {
    const bus = this.#bus({ headers: {} });
    for (const transaction of bus.transactionStore.listTransactions()) {
      if (["committing", "recovery_required"].includes(transaction.status)) {
        bus.recoverTransaction({ transactionId: transaction.transaction_id });
      }
    }
  }

  async #handle(request, response) {
    const origin = this.#origin(request);
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-PrintForm-Server-Token, X-PrintForm-Owner, X-PrintForm-Agent-Id, X-PrintForm-Failure-Phase, X-PrintForm-Crash-At, X-PrintForm-Drop-After-Commit, X-PrintForm-Crash-After-Commit, X-PrintForm-Delay-Ms",
        ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
      });
      response.end();
      return;
    }
    this.#authorize(request);
    const url = new URL(request.url, `http://${this.host}`);
    if (this.testMode && url.pathname === "/__test__/shutdown" && request.method === "POST") {
      jsonResponse(response, 200, { ok: true }, origin);
      setTimeout(() => this.close().then(() => process.exit(0)), 0);
      return;
    }
    if (url.pathname === "/health" && request.method === "GET") {
      jsonResponse(response, 200, { ok: true, server_time: this.backend.serverNow().toISOString(), pid: process.pid, database: this.backend.summary() }, origin);
      return;
    }
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] !== "v1" || parts[1] !== "forms" || decodeURIComponent(parts[2] || "") !== this.formId) {
      throw Object.assign(new Error("Route not found"), { code: "NOT_FOUND", status: 404 });
    }
    if (request.headers["x-printform-drop-before"] === "true") { request.socket.destroy(); return; }
    const body = ["POST"].includes(request.method) ? await readJson(request) : {};
    if (parts[3] === "command" && request.method === "POST") {
      await this.#command(request, response, body, origin);
      return;
    }
    if (parts[3] === "evidence" && request.method === "POST") {
      await this.#evidence(request, response, body, origin);
      return;
    }
    if (parts[3] === "audit" && request.method === "GET") {
      jsonResponse(response, 200, { ok: true, events: this.#store().listAuditEvents() }, origin);
      return;
    }
    if (parts[3] === "revision" && request.method === "GET") {
      jsonResponse(response, 200, { ok: true, revision: this.#store().getRevision() }, origin);
      return;
    }
    if (parts[3] === "evidence" && request.method === "GET") {
      const revision = url.searchParams.has("revision") ? Number(url.searchParams.get("revision")) : undefined;
      const store = this.#store();
      jsonResponse(response, 200, { ok: true, evidencePack: store.getEvidencePack(revision), anchor: store.getEvidenceAnchor(revision) }, origin);
      return;
    }
    throw Object.assign(new Error("Route not found"), { code: "NOT_FOUND", status: 404 });
  }

  async #command(request, response, body, origin) {
    const name = body.name;
    if (!SERVER_COMMANDS.has(name)) throw Object.assign(new Error(`Unsupported server command: ${name}`), { code: "UNKNOWN_TOOL" });
    const input = body.input || {};
    const store = this.#store();
    const transaction = name === "apply_changes" && input.transactionId ? store.getTransaction(input.transactionId) : null;
    if (name === "apply_changes" && transaction?.status === "committed") {
      if (input.expectedCandidateHash && transaction.preview_hash !== input.expectedCandidateHash) throw Object.assign(new Error("Idempotency key was reused for a different candidate"), { code: "IDEMPOTENCY_KEY_REUSE" });
      this.#respondAfterNetworkPolicy(request, response, { ok: true, result: { already_committed: true, committed_revision: transaction.working_revision, transaction } }, origin);
      return;
    }
    if (name === "apply_changes" && ["committing", "recovery_required"].includes(transaction?.status)) {
      throw Object.assign(new Error("Commit is in progress or requires recovery"), { code: "COMMIT_IN_PROGRESS", transactionId: transaction.transaction_id, status: transaction.status });
    }
    const failurePhase = request.headers["x-printform-failure-phase"] || request.headers["x-printform-crash-at"] || null;
    const crashPhase = request.headers["x-printform-crash-at"] || null;
    const bus = this.#bus(request, failurePhase);
    const result = await bus.execute(name, input);
    if (!result.ok && crashPhase && crashPhase === result.error?.phase) {
      this.#crash(request, response, result.error.phase);
      return;
    }
    if (result.ok && name === "apply_changes") {
      result.result = { ...result.result, already_committed: false, committed_revision: result.result.revision };
      if (request.headers["x-printform-crash-after-commit"] === "true") {
        this.#crash(request, response, "after_commit_before_response");
        return;
      }
    }
    this.#respondAfterNetworkPolicy(request, response, result, origin);
  }

  async #evidence(request, response, pack, origin) {
    const store = this.#store();
    const existing = Number.isInteger(pack.revision) ? store.getEvidenceAnchor(pack.revision) : null;
    if (existing) {
      if (existing.evidence_pack_hash !== pack.hash) throw Object.assign(new Error("A different Evidence Pack is already anchored"), { code: "EVIDENCE_ANCHOR_CONFLICT" });
      this.#respondAfterNetworkPolicy(request, response, { ok: true, result: { already_anchored: true, anchor: existing, evidencePack: store.getEvidencePack(pack.revision) } }, origin);
      return;
    }
    const failurePhase = request.headers["x-printform-failure-phase"] || request.headers["x-printform-crash-at"] || null;
    const bus = this.#bus(request, failurePhase);
    try {
      const evidencePack = bus.recordEvidencePack(pack);
      if (request.headers["x-printform-crash-at"] === "during_evidence_write") {
        this.#crash(request, response, "during_evidence_write");
        return;
      }
      this.#respondAfterNetworkPolicy(request, response, { ok: true, result: { already_anchored: false, evidencePack, anchor: store.getEvidenceAnchor(pack.revision) } }, origin);
    } catch (error) {
      if (request.headers["x-printform-crash-at"] && request.headers["x-printform-crash-at"] === error.phase) this.#crash(request, response, error.phase);
      else throw error;
    }
  }

  #respondAfterNetworkPolicy(request, response, body, origin) {
    const send = () => {
      if (request.headers["x-printform-drop-after-commit"] === "true") { request.socket.destroy(); return; }
      jsonResponse(response, body.ok ? 200 : statusForError(body.error || {}), body, origin);
    };
    const delay = Math.max(0, Number(request.headers["x-printform-delay-ms"]) || 0);
    if (delay) setTimeout(send, delay); else send();
  }

  #crash(request, response, phase) {
    response.destroy();
    if (this.onCrash) this.onCrash(phase);
  }

  #fail(request, response, error) {
    if (response.destroyed || response.headersSent) return;
    console.error(`[printform-transaction-server] ${error.code || "SERVER_ERROR"}: ${error.message}`);
    const status = error.status || statusForError(error);
    jsonResponse(response, status, { ok: false, error: { code: error.code || "SERVER_ERROR", message: error.message, expectedRevision: error.expectedRevision, actualRevision: error.actualRevision, transactionId: error.transactionId, phase: error.phase } }, this.#origin(request));
  }
}
