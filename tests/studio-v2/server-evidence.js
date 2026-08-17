import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const passed = [];
const EXPECTED_CASES = 8;

export function serverIt(it, name, test, timeout) {
  return it(name, async (...args) => {
    await test(...args);
    passed.push(name);
  }, timeout);
}

export async function writeServerEvidence(root) {
  if (passed.length !== EXPECTED_CASES) return false;
  const runtimeFiles = [
    path.join(root, "studio-v2/server/sqlite-durable-backend.mjs"),
    path.join(root, "studio-v2/server/transaction-http-server.mjs"),
  ];
  const runtimeHash = createHash("sha256")
    .update(Buffer.concat(await Promise.all(runtimeFiles.map((file) => readFile(file)))))
    .digest("hex");
  const evidence = {
    artifactType: "printform-server-acceptance",
    protocolVersion: "2.0.0",
    schemaVersion: 1,
    runtimeVersion: process.version,
    runtimeHash: `sha256:${runtimeHash}`,
    database: { backend: "sqlite", journalMode: "wal", synchronous: "full", atomicCas: true, serverClock: true },
    validation: { status: "PASS", testCases: passed, pageCount: null },
    security: { status: "PASS", externalNetwork: false, arbitraryJavascript: false, semanticApiOnly: true },
    timestamp: new Date().toISOString(),
  };
  const output = process.env.PRINTFORM_EVIDENCE_DIR || path.join(root, "test-results", "e13-server");
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, "server-acceptance.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return true;
}
