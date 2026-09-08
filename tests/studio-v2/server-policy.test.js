import { access, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { classifyImportedDocument, classifyRealDocument } from "../../studio-v2/core/data-policy.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";
import { TransactionHttpServer } from "../../studio-v2/server/transaction-http-server.mjs";

const FORM_ID = "server-policy-canary";

async function postCommand(address, input) {
  const response = await fetch(`${address.url}/v1/forms/${FORM_ID}/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "begin_transaction", input }),
  });
  return { status: response.status, body: await response.json() };
}

describe("server data policy boundary", () => {
  it("blocks Unknown and Real document persistence before SQLite initialization", async () => {
    for (const [classification, dataPolicy] of [
      ["unknown", classifyImportedDocument(FORM_ID)],
      ["real", classifyRealDocument(FORM_ID)],
    ]) {
      const directory = await mkdtemp(path.join(os.tmpdir(), "printform-policy-server-"));
      const dbPath = path.join(directory, "transactions.sqlite");
      const server = new TransactionHttpServer({
        dbPath,
        formId: FORM_ID,
        initialProject: createSalesInvoiceProject(),
        host: "127.0.0.1",
        port: 0,
        allowedOrigins: [],
        dataPolicy,
      });
      try {
        const address = await server.start();
        const health = await fetch(`${address.url}/health`).then((response) => response.json());
        const blocked = await postCommand(address, { baseRevision: 0 });
        expect(health.database).toMatchObject({ classification, persistence_allowed: false, transactions: 0 });
        expect(blocked).toMatchObject({ status: 403, body: { ok: false, error: { code: "DATA_POLICY_STORAGE_BLOCKED" } } });
      } finally {
        await server.close();
        await expect(access(dbPath)).rejects.toThrow();
        await rm(directory, { recursive: true, force: true });
      }
    }
  });
});
