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
    execute: async (name, input = {}) => executeAgentCommand(bus, name, typeof input === "string" ? JSON.parse(input) : input)
  });
  Object.defineProperty(globalScope, "PrintFormStudioAgent", { configurable: true, value: gateway });
  return gateway;
}
