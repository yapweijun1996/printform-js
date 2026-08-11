import { AGENT_CONTRACT_VERSION } from "../core/constants.js";
import { TOOL_CONTRACTS } from "../core/tool-contracts.js";
import { sanitizeAgentResponse } from "../core/agent-sanitize.js";

const MUTATIONS = new Set(["apply_changes", "set_sample_scenario", "set_locale", "set_asset_source", "undo_revision", "redo_revision"]);

export async function executeAgentCommand(bus, name, input, { realData = false } = {}) {
  if (realData && name === "capture_layout_evidence" && input?.visualMode === "pixels") {
    return { ok: false, error: { code: "PIXEL_EVIDENCE_SYNTHETIC_ONLY", message: "Pixel evidence is available only for synthetic-data sessions" } };
  }
  if (bus.project.trust === "untrusted" && MUTATIONS.has(name)) {
    return { ok: false, error: { code: "UNTRUSTED_READ_ONLY", message: "Agent mutations are disabled until a human reviews and resets project trust" } };
  }
  return sanitizeAgentResponse(name, await bus.execute(name, input), { realData });
}

export function installAgentGateway(bus, globalScope = window, { isRealData = () => false } = {}) {
  const gateway = Object.freeze({
    contractVersion: AGENT_CONTRACT_VERSION,
    listTools: () => TOOL_CONTRACTS,
    execute: async (name, input = {}) => {
      let parsed = input;
      if (typeof input === "string") {
        // Keep the uniform {ok:false, error} contract — a malformed JSON string
        // must not reject the promise while every other failure resolves.
        try { parsed = JSON.parse(input); }
        catch (error) { return { ok: false, error: { code: "INVALID_INPUT_JSON", message: error.message } }; }
      }
      return executeAgentCommand(bus, name, parsed, { realData: Boolean(isRealData()) });
    }
  });
  Object.defineProperty(globalScope, "PrintFormStudioAgent", { configurable: true, value: gateway });
  return gateway;
}
