import { AGENT_CONTRACT_VERSION } from "../core/constants.js";
import { TOOL_CONTRACTS } from "../core/tool-contracts.js";

const MUTATIONS = new Set(["apply_changes", "set_sample_scenario", "set_locale", "set_asset_source", "undo_revision"]);

export function executeAgentCommand(bus, name, input) {
  if (bus.project.trust === "untrusted" && MUTATIONS.has(name)) {
    return Promise.resolve({ ok: false, error: { code: "UNTRUSTED_READ_ONLY", message: "Agent mutations are disabled until a human reviews and resets project trust" } });
  }
  return bus.execute(name, input);
}

export function installAgentGateway(bus, globalScope = window) {
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
      return executeAgentCommand(bus, name, parsed);
    }
  });
  Object.defineProperty(globalScope, "PrintFormStudioAgent", { configurable: true, value: gateway });
  return gateway;
}
