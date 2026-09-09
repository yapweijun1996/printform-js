import { AgentHarness, MemorySessionRepo } from "@earendil-works/pi-agent-core";
import { PI02_PIN, browserRuntime } from "./qualification-env.js";
import { runPi02Case } from "./qualification-cases.js";

const QUALIFICATION_KEY = "__PI_02_QUALIFICATION__";

async function runCase(caseId) {
  try {
    const result = await runPi02Case(caseId);
    const output = document.querySelector("#qualification-result");
    if (output) output.textContent = JSON.stringify({ caseId, status: "passed", result }, null, 2);
    return { caseId, status: "passed", result };
  } catch (error) {
    const result = { caseId, status: "failed", error: { code: error?.code || "PI02_CASE_FAILED", message: error?.message || String(error) } };
    const output = document.querySelector("#qualification-result");
    if (output) output.textContent = JSON.stringify(result, null, 2);
    return result;
  }
}

globalThis[QUALIFICATION_KEY] = Object.freeze({
  id: "PI-02",
  status: "ready",
  pin: PI02_PIN,
  browser: browserRuntime(),
  actualHarness: typeof AgentHarness.create === "function",
  actualMemorySessionRepo: typeof MemorySessionRepo === "function",
  runCase
});
