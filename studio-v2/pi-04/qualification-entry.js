import { AgentHarness } from "@earendil-works/pi-agent-core";
import { PI04_PIN, browserRuntime } from "./qualification-env.js";
import { runPi04Case } from "./qualification-cases.js";

const QUALIFICATION_KEY = "__PI_04_QUALIFICATION__";

async function runCase(caseId) {
  try {
    const result = await runPi04Case(caseId);
    const output = document.querySelector("#qualification-result");
    if (output) output.textContent = JSON.stringify({ caseId, status: "passed", result }, null, 2);
    return { caseId, status: "passed", result };
  } catch (error) {
    const result = { caseId, status: "failed", error: { code: error?.code || "PI04_CASE_FAILED", message: error?.message || String(error) } };
    const output = document.querySelector("#qualification-result");
    if (output) output.textContent = JSON.stringify(result, null, 2);
    return result;
  }
}

globalThis[QUALIFICATION_KEY] = Object.freeze({
  id: "PI-04", status: "ready", pin: PI04_PIN, browser: browserRuntime(),
  actualHarness: typeof AgentHarness.create === "function", policyBound: true,
  frontendOnly: true, runCase
});
