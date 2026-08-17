#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { TransactionHttpServer } from "../studio-v2/server/transaction-http-server.mjs";
import { DurableTransactionStore } from "../studio-v2/core/durable-transaction-store.js";
import { createSalesInvoiceProject } from "../studio-v2/samples/sales-invoice.js";

function option(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const initialProject = createSalesInvoiceProject();
const dbPath = path.resolve(option("--db", path.join(os.tmpdir(), "printform-studio-v2.sqlite")));
const formId = option("--form-id", DurableTransactionStore.formId(initialProject));
const port = Number(option("--port", process.env.PORT || 4175));
const leaseDurationMs = Number(option("--lease-ms", process.env.PRINTFORM_LEASE_MS || 30_000));
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

let crashTimer = null;
const server = new TransactionHttpServer({
  dbPath,
  formId,
  initialProject,
  port,
  leaseDurationMs,
  serverToken: process.env.PRINTFORM_TRANSACTION_SERVER_TOKEN || "",
  testMode: process.env.PRINTFORM_TRANSACTION_SERVER_TEST_MODE === "1",
  onCrash: () => {
    crashTimer = setTimeout(() => process.exit(86), 10);
  },
});

const address = await server.start();
console.log(`READY ${address.url} form=${formId} pid=${process.pid}`);

async function shutdown(code = 0) {
  if (crashTimer) clearTimeout(crashTimer);
  try { await server.close(); } finally { process.exit(code); }
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("uncaughtException", (error) => {
  console.error(error);
  shutdown(1);
});
process.on("unhandledRejection", (error) => {
  console.error(error);
  shutdown(1);
});
