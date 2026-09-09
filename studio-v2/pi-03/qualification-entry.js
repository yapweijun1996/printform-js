import { AgentHarness, MemorySessionRepo, StorageBackedSession } from "@earendil-works/pi-agent-core";
import { PI03_PIN, browserRuntime } from "./qualification-env.js";
import { runPi03Case } from "./qualification-cases.js";

const QUALIFICATION_KEY = "__PI_03_QUALIFICATION__";

async function runCase(caseId) {
  try {
    const result = await runPi03Case(caseId);
    const output = document.querySelector("#qualification-result");
    if (output) output.textContent = JSON.stringify({ caseId, status: "passed", result }, null, 2);
    return { caseId, status: "passed", result };
  } catch (error) {
    const result = { caseId, status: "failed", error: { code: error?.code || "PI03_CASE_FAILED", message: error?.message || String(error) } };
    const output = document.querySelector("#qualification-result");
    if (output) output.textContent = JSON.stringify(result, null, 2);
    return result;
  }
}

globalThis[QUALIFICATION_KEY] = Object.freeze({
  id: "PI-03",
  status: "ready",
  pin: PI03_PIN,
  browser: browserRuntime(),
  actualHarness: typeof AgentHarness.create === "function",
  actualMemorySessionRepo: typeof MemorySessionRepo === "function",
  actualStorageBackedSession: typeof StorageBackedSession === "function",
  runCase
});
