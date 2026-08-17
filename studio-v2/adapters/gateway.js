import { AGENT_CONTRACT_VERSION } from "../core/constants.js";
import { TOOL_CONTRACTS } from "../core/tool-contracts.js";
import { sanitizeAgentResponse } from "../core/agent-sanitize.js";
import { AGENT_OPERATION_DEFINITIONS } from "../core/operation-schemas.js";

const MUTATIONS = new Set(["apply_changes", "set_sample_scenario", "set_locale", "set_asset_source", "undo_revision", "redo_revision", "renew_lease", "release_lease", "recover_transaction", "resolve_conflict", "rollback_transaction", "takeover_transaction"]);

function rejectRawAgentSurface(name, input) {
  if (name === "preview_source_edit") {
    return { code: "AGENT_RAW_SOURCE_BLOCKED", message: "The Agent API may edit FormSpec components only; raw source preview is Studio-internal." };
  }
  if (name !== "preview_changes" || !Array.isArray(input?.operations)) return null;
  const unsafe = input.operations.find((operation) => !operation || !AGENT_OPERATION_DEFINITIONS[operation.type]);
  return unsafe ? { code: "AGENT_OPERATION_NOT_ALLOWED", message: `Operation ${unsafe.type || "unknown"} is not available through the semantic Agent API.` } : null;
}

export async function executeAgentCommand(bus, name, input, { realData = false } = {}) {
  if (realData && name === "capture_layout_evidence" && input?.visualMode === "pixels") {
    return { ok: false, error: { code: "PIXEL_EVIDENCE_SYNTHETIC_ONLY", message: "Pixel evidence is available only for synthetic-data sessions" } };
  }
  if (bus.project.trust === "untrusted" && MUTATIONS.has(name)) {
    return { ok: false, error: { code: "UNTRUSTED_READ_ONLY", message: "Agent mutations are disabled until a human reviews and resets project trust" } };
  }
  const rawSurfaceError = rejectRawAgentSurface(name, input);
  if (rawSurfaceError) return { ok: false, error: rawSurfaceError };
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
