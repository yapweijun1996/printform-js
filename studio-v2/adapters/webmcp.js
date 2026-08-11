import { TOOL_CONTRACTS } from "../core/tool-contracts.js";
import { executeAgentCommand } from "./gateway.js";

// WebMCP (Web Model Context) lives on navigator.modelContext per the
// webmachinelearning/webmcp explainer; document.modelContext is kept as a
// legacy fallback for earlier prototypes and the unit tests.
function resolveModelContext(host) {
  if (host?.modelContext) return host.modelContext;
  if (typeof navigator !== "undefined" && navigator.modelContext) return navigator.modelContext;
  if (typeof document !== "undefined" && document.modelContext) return document.modelContext;
  return null;
}

function toToolDefinition(bus, contract, options) {
  return {
    name: contract.name,
    description: contract.description,
    inputSchema: contract.inputSchema,
    async execute(input = {}) {
      const response = await executeAgentCommand(bus, contract.name, input, { realData: Boolean(options.isRealData()) });
      return {
        content: [{ type: "text", text: JSON.stringify(response) }],
        structuredContent: response,
        isError: !response.ok
      };
    }
  };
}

export function installWebMcpAdapter(bus, host = null, options = {}) {
  const adapterOptions = { ...options, isRealData: typeof options.isRealData === "function" ? options.isRealData : () => false };
  const modelContext = resolveModelContext(host);
  if (!modelContext) return { supported: false, api: "none", registered: [], dispose() {} };
  const tools = TOOL_CONTRACTS.map((contract) => toToolDefinition(bus, contract, adapterOptions));

  if (typeof modelContext.registerTool === "function") {
    const controller = new AbortController();
    const registered = [];
    tools.forEach((tool) => {
      try {
        modelContext.registerTool(tool, { signal: controller.signal });
        registered.push(tool.name);
      } catch (error) {
        console.warn(`WebMCP registration failed for ${tool.name}`, error);
      }
    });
    return { supported: registered.length > 0, api: "registerTool", registered, dispose: () => controller.abort() };
  }

  if (typeof modelContext.provideContext === "function") {
    try {
      modelContext.provideContext({ tools });
      return {
        supported: true,
        api: "provideContext",
        registered: tools.map((tool) => tool.name),
        // provideContext replaces the page's whole tool context, so disposing
        // means providing an empty one.
        dispose: () => modelContext.provideContext({ tools: [] })
      };
    } catch (error) {
      console.warn("WebMCP provideContext failed", error);
    }
  }

  return { supported: false, api: "none", registered: [], dispose() {} };
}
