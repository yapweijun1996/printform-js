import { afterAll, afterEach, describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DurableTransactionStore } from "../../studio-v2/core/durable-transaction-store.js";
import { applyOperations } from "../../studio-v2/core/operations.js";
import { createEvidencePack } from "../../studio-v2/core/evidence-pack.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";
import { SqliteDurableBackend } from "../../studio-v2/server/sqlite-durable-backend.mjs";
import { serverIt, writeServerEvidence } from "./server-evidence.js";

const ROOT = path.resolve(process.cwd());
const SERVER_SCRIPT = path.join(ROOT, "scripts", "transaction-server.mjs");
const FORM_ID = "sales-invoice-pilot";
const handles = [];

async function startServer({ dbPath, leaseMs = 30_000 } = {}) {
  const child = spawn(process.execPath, [SERVER_SCRIPT, "--db", dbPath, "--port", "0", "--lease-ms", String(leaseMs)], {
    cwd: ROOT,
    env: { ...process.env, PRINTFORM_TRANSACTION_SERVER_TOKEN: "test-server-token", PRINTFORM_TRANSACTION_SERVER_TEST_MODE: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const started = new Promise((resolve, reject) => {
    const onOutput = (chunk) => {
      output += chunk.toString();
      const match = output.match(/READY (http:\/\/[^ ]+)/);
      if (match) resolve({ child, baseUrl: match[1], output });
    };
    child.stdout.on("data", onOutput);
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (!output.includes("READY ")) reject(new Error(`transaction server exited before READY: ${code}/${signal}\n${output}`));
    });
  });
  const handle = await started;
  handle.logs = () => output;
  handles.push(handle);
  return handle;
}

async function stopServer(handle) {
  if (!handle?.child || handle.child.exitCode !== null) return;
  const exited = new Promise((resolve) => handle.child.once("exit", resolve));
  try {
    await fetch(`${handle.baseUrl}/__test__/shutdown`, {
      method: "POST",
      headers: { "X-PrintForm-Server-Token": "test-server-token" },
    });
  } catch { /* the process may already be in a crash path */ }
  await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]);
  if (handle.child.exitCode === null) {
    handle.child.kill();
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 1500))]);
  }
}

async function waitForExit(handle) {
  if (handle.child.exitCode !== null) return;
  await Promise.race([
    new Promise((resolve) => handle.child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]);
}

async function waitForCommitted(server, transactionId, owner = "ops") {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const result = await command(server, "get_transaction", { transactionId }, { owner, agentId: owner });
    if (result.data?.result?.transaction?.status === "committed") return result.data.result.transaction;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Transaction did not become committed: ${transactionId}`);
}

async function waitForEvidence(server, revision) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const result = await request(server, `/v1/forms/${FORM_ID}/evidence?revision=${revision}`);
    if (result.data?.anchor) return result.data;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Evidence did not become anchored: revision ${revision}`);
}

async function request(server, pathname, body = undefined, options = {}) {
  const headers = {
    ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    "X-PrintForm-Server-Token": "test-server-token",
    ...(options.owner ? { "X-PrintForm-Owner": options.owner } : {}),
    ...(options.agentId ? { "X-PrintForm-Agent-Id": options.agentId } : {}),
    ...(options.headers || {}),
  };
  let response;
  try {
    response = await fetch(`${server.baseUrl}${pathname}`, {
    method: body === undefined ? "GET" : "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: options.signal,
    });
  } catch (error) {
    throw new Error(`${error.message}\nserver logs:\n${server.logs?.() || "(unavailable)"}`, { cause: error });
  }
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}

function command(server, name, input = {}, options = {}) {
  return request(server, `/v1/forms/${FORM_ID}/command`, { name, input }, options);
}

async function createFlow(server, owner, title) {
  const started = await command(server, "begin_transaction", { baseRevision: 0 }, { owner, agentId: owner });
  expect(started.status).toBe(200);
  const transactionId = started.data.result.transaction_id;
  const preview = await command(server, "preview_changes", {
    expectedRevision: 0,
    transactionId,
    operations: [{ type: "set_manifest_value", path: "/title", value: title }],
  }, { owner, agentId: owner });
  expect(preview.status).toBe(200);
  const approval = await command(server, "approve_transaction", {
    expectedRevision: 0,
    transactionId,
    expectedCandidateHash: preview.data.result.candidateHash,
  }, { owner, agentId: owner });
  expect(approval.status).toBe(200);
  return { transactionId, candidateHash: preview.data.result.candidateHash };
}

async function tempDatabase() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "printform-e13-server-"));
  return { directory, dbPath: path.join(directory, "transactions.sqlite") };
}

afterEach(async () => {
  for (const handle of handles.splice(0)) await stopServer(handle);
});

afterAll(async () => { await writeServerEvidence(ROOT); });

describe("E13-SERVER durable backend acceptance", () => {
  serverIt(it, "uses a real SQLite file, normalized projections and atomic SQL CAS", async () => {
    const { directory, dbPath } = await tempDatabase();
    const project = createSalesInvoiceProject();
    const first = new SqliteDurableBackend({ filename: dbPath });
    const second = new SqliteDurableBackend({ filename: dbPath });
    const store = new DurableTransactionStore({ backend: first, key: "form:sales-invoice-pilot", formId: FORM_ID, initialProject: project });
    const next = { ...project, revision: 1, manifest: { ...project.manifest, title: "SQLite revision" } };
    expect(store.compareAndSwapHead({ expectedRevision: 0, nextProject: next, nextProjectHash: "sha256:one", transactionId: "tx-sqlite" }).ok).toBe(true);
    expect(second.read("form:sales-invoice-pilot").head.revision).toBe(1);
    expect(second.compareAndSwap("form:sales-invoice-pilot", 0, { ...second.read("form:sales-invoice-pilot"), version: 2 })).toBe(false);
    expect(first.summary()).toMatchObject({ journal_mode: "wal", revisions: 2 });
    expect(first.serverNow()).toBeInstanceOf(Date);
    first.close();
    second.close();
    await rm(directory, { recursive: true, force: true });
  });

  serverIt(it, "allows one of two independent sessions to commit and rejects the stale CAS", async () => {
    const { directory, dbPath } = await tempDatabase();
    const server = await startServer({ dbPath });
    const a = await createFlow(server, "user-a", "from A");
    const b = await createFlow(server, "user-b", "from B");
    const [aResult, bResult] = await Promise.all([
      command(server, "apply_changes", { expectedRevision: 0, transactionId: a.transactionId, expectedCandidateHash: a.candidateHash }, { owner: "user-a", agentId: "agent-a" }),
      command(server, "apply_changes", { expectedRevision: 0, transactionId: b.transactionId, expectedCandidateHash: b.candidateHash }, { owner: "user-b", agentId: "agent-b" }),
    ]);
    const results = [aResult, bResult];
    expect(results.filter((result) => result.status === 200)).toHaveLength(1);
    const conflict = results.find((result) => result.status === 409);
    expect(conflict.data.error).toMatchObject({ code: "REVISION_CONFLICT", expectedRevision: 0, actualRevision: 1 });
    const revision = await request(server, `/v1/forms/${FORM_ID}/revision`);
    expect(revision.data.revision.revision).toBe(1);
    const audit = await request(server, `/v1/forms/${FORM_ID}/audit`);
    expect(audit.data.events.map((event) => event.type)).toEqual(expect.arrayContaining(["revision_committed", "conflict_detected"]));
    await stopServer(server);
    await rm(directory, { recursive: true, force: true });
  }, 15_000);

  serverIt(it, "makes a lost response retry idempotent without a second revision", async () => {
    const { directory, dbPath } = await tempDatabase();
    const server = await startServer({ dbPath });
    const flow = await createFlow(server, "user-a", "retry-safe");
    await expect(command(server, "apply_changes", { expectedRevision: 0, transactionId: flow.transactionId, expectedCandidateHash: flow.candidateHash }, {
      owner: "user-a",
      agentId: "agent-a",
      headers: { "X-PrintForm-Drop-After-Commit": "true" },
    })).rejects.toThrow();
    await waitForCommitted(server, flow.transactionId, "user-a");
    const retry = await command(server, "apply_changes", { expectedRevision: 0, transactionId: flow.transactionId, expectedCandidateHash: flow.candidateHash }, { owner: "user-a", agentId: "agent-a" });
    expect(retry.data.result).toMatchObject({ already_committed: true, committed_revision: 1 });
    const revision = await request(server, `/v1/forms/${FORM_ID}/revision`);
    expect(revision.data.revision.revision).toBe(1);
    const audit = await request(server, `/v1/forms/${FORM_ID}/audit`);
    expect(audit.data.events.filter((event) => event.type === "revision_committed")).toHaveLength(1);
    await stopServer(server);
    await rm(directory, { recursive: true, force: true });
  }, 15_000);

  serverIt(it, "uses server database time for expiry despite a skewed client timestamp", async () => {
    const { directory, dbPath } = await tempDatabase();
    const server = await startServer({ dbPath, leaseMs: 120 });
    const started = await command(server, "begin_transaction", { baseRevision: 0, clientNow: "2099-01-01T00:00:00.000Z" }, { owner: "user-a", agentId: "agent-a" });
    const tx = started.data.result;
    await new Promise((resolve) => setTimeout(resolve, 250));
    const renew = await command(server, "renew_lease", { transactionId: tx.transaction_id, leaseId: tx.lease.lease_id, clientNow: "2000-01-01T00:00:00.000Z" }, { owner: "user-a", agentId: "agent-a" });
    expect(renew.status).toBe(409);
    expect(renew.data.error.code).toBe("LEASE_EXPIRED");
    const takeover = await command(server, "takeover_transaction", { transactionId: tx.transaction_id, owner: "user-b", agentId: "agent-b" }, { owner: "user-b", agentId: "agent-b" });
    expect(takeover.data.result).toMatchObject({ status: "draft", owner: "user-b", supersedes_transaction_id: tx.transaction_id });
    const health = await request(server, "/health");
    expect(Number.isNaN(Date.parse(health.data.server_time))).toBe(false);
    await stopServer(server);
    await rm(directory, { recursive: true, force: true });
  }, 15_000);

  serverIt(it, "recovers a process crash before CAS as rolled back", async () => {
    const { directory, dbPath } = await tempDatabase();
    let server = await startServer({ dbPath });
    const flow = await createFlow(server, "user-a", "before CAS");
    await expect(command(server, "apply_changes", { expectedRevision: 0, transactionId: flow.transactionId, expectedCandidateHash: flow.candidateHash }, {
      owner: "user-a", agentId: "agent-a", headers: { "X-PrintForm-Crash-At": "during_commit" },
    })).rejects.toThrow();
    await waitForExit(server);
    server = await startServer({ dbPath });
    const tx = await command(server, "get_transaction", { transactionId: flow.transactionId }, { owner: "ops", agentId: "recovery" });
    expect(tx.data.result.transaction).toMatchObject({ status: "rolled_back", state: "ROLLED_BACK" });
    const revision = await request(server, `/v1/forms/${FORM_ID}/revision`);
    expect(revision.data.revision.revision).toBe(0);
    await stopServer(server);
    await rm(directory, { recursive: true, force: true });
  }, 15_000);

  serverIt(it, "recovers a process crash after CAS as committed and makes retry idempotent", async () => {
    const { directory, dbPath } = await tempDatabase();
    let server = await startServer({ dbPath });
    const flow = await createFlow(server, "user-a", "after CAS");
    await expect(command(server, "apply_changes", { expectedRevision: 0, transactionId: flow.transactionId, expectedCandidateHash: flow.candidateHash }, {
      owner: "user-a", agentId: "agent-a", headers: { "X-PrintForm-Crash-At": "after_revision_write" },
    })).rejects.toThrow();
    await waitForExit(server);
    server = await startServer({ dbPath });
    const recovered = await command(server, "get_transaction", { transactionId: flow.transactionId }, { owner: "ops", agentId: "recovery" });
    expect(recovered.data.result.transaction).toMatchObject({ status: "committed", working_revision: 1 });
    const retry = await command(server, "apply_changes", { expectedRevision: 0, transactionId: flow.transactionId, expectedCandidateHash: flow.candidateHash }, { owner: "user-a", agentId: "agent-a" });
    expect(retry.data.result).toMatchObject({ already_committed: true, committed_revision: 1 });
    await stopServer(server);
    await rm(directory, { recursive: true, force: true });
  }, 15_000);

  serverIt(it, "fails closed on a timeout and preserves durable idempotency on reconnect", async () => {
    const { directory, dbPath } = await tempDatabase();
    const server = await startServer({ dbPath });
    const flow = await createFlow(server, "user-a", "network retry");
    await expect(command(server, "apply_changes", { expectedRevision: 0, transactionId: flow.transactionId, expectedCandidateHash: flow.candidateHash }, {
      owner: "user-a", agentId: "agent-a", headers: { "X-PrintForm-Drop-After-Commit": "true", "X-PrintForm-Delay-Ms": "250" },
    })).rejects.toThrow();
    await waitForCommitted(server, flow.transactionId, "user-a");
    const retry = await command(server, "apply_changes", { expectedRevision: 0, transactionId: flow.transactionId, expectedCandidateHash: flow.candidateHash }, { owner: "user-a", agentId: "agent-a" });
    expect(retry.data.result).toMatchObject({ already_committed: true, committed_revision: 1 });
    await stopServer(server);
    await expect(fetch(`${server.baseUrl}/health`)).rejects.toThrow();
    await rm(directory, { recursive: true, force: true });
  }, 15_000);

  serverIt(it, "anchors Evidence Pack durably and makes evidence retry idempotent", async () => {
    const { directory, dbPath } = await tempDatabase();
    const server = await startServer({ dbPath });
    const flow = await createFlow(server, "user-a", "evidence");
    const committed = await command(server, "apply_changes", { expectedRevision: 0, transactionId: flow.transactionId, expectedCandidateHash: flow.candidateHash }, { owner: "user-a", agentId: "agent-a" });
    expect(committed.status).toBe(200);
    const project = createSalesInvoiceProject();
    const candidate = applyOperations(project, [{ type: "set_manifest_value", path: "/title", value: "evidence" }]);
    const pack = await createEvidencePack({
      project: candidate,
      revision: 1,
      transactionId: flow.transactionId,
      previewHash: flow.candidateHash,
      validation: { productionValid: true, errors: [], metrics: { logicalPages: 1 } },
      security: { valid: true, externalNetwork: false, arbitraryJavascript: false },
    });
    const first = await request(server, `/v1/forms/${FORM_ID}/evidence`, pack, { owner: "user-a", agentId: "agent-a", headers: { "X-PrintForm-Drop-After-Commit": "true" } }).catch((error) => ({ error }));
    expect(first.error).toBeTruthy();
    await waitForEvidence(server, 1);
    const retry = await request(server, `/v1/forms/${FORM_ID}/evidence`, pack, { owner: "user-a", agentId: "agent-a" });
    expect(retry.data.result).toMatchObject({ already_anchored: true, anchor: { evidence_pack_hash: pack.hash, committed_revision: 1 } });
    const audit = await request(server, `/v1/forms/${FORM_ID}/audit`);
    expect(audit.data.events.filter((event) => event.type === "evidence_anchored")).toHaveLength(1);
    const summary = await request(server, "/health");
    expect(summary.data.database.evidence_anchors).toBe(1);
    await stopServer(server);
    await rm(directory, { recursive: true, force: true });
  }, 15_000);
});
