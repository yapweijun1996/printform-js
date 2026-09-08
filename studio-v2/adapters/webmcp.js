import { TOOL_CONTRACTS } from "../core/tool-contracts.js";
import { createAgentContext, createAgentSessionId } from "../core/agent-context.js";
import { classifyImportedDocument } from "../core/data-policy.js";
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
      const context = options.getAgentContext?.() || options.agentContext;
      if (context) {
        context.dataPolicy = options.getDataPolicy?.() || context.dataPolicy;
        context.scope = options.getScopeContext?.() || context.scope;
        context.applyMode = options.getApplyMode?.() || context.applyMode;
      }
      const response = await executeAgentCommand(bus, contract.name, input, { ...options, context, realData: Boolean(options.isRealData()) });
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
  let fallbackPolicy = options.dataPolicy
    || (bus.dataPolicy?.classification === "unknown" ? bus.dataPolicy : null);
  const hostPolicy = typeof options.getDataPolicy === "function" ? options.getDataPolicy : null;
  adapterOptions.getDataPolicy = () => {
    if (hostPolicy) {
      const current = hostPolicy();
      if (current) return current;
      if (!fallbackPolicy || fallbackPolicy.classification !== "unknown"
        || fallbackPolicy.documentId !== bus.project.manifest?.documentId) {
        fallbackPolicy = classifyImportedDocument(bus.project.manifest?.documentId);
      }
      return fallbackPolicy;
    }
    if (fallbackPolicy) return fallbackPolicy;
    fallbackPolicy = classifyImportedDocument(bus.project.manifest?.documentId);
    return fallbackPolicy;
  };
  let contextPolicy = adapterOptions.getDataPolicy();
  const sessionId = options.sessionId || createAgentSessionId("webmcp");
  let agentContext = options.agentContext || createAgentContext({ dataPolicy: contextPolicy, sessionId, currentPolicy: adapterOptions.getDataPolicy });
  adapterOptions.getAgentContext = () => {
    const nextPolicy = adapterOptions.getDataPolicy();
    if (nextPolicy?.contextId !== contextPolicy?.contextId
      || nextPolicy?.generation !== contextPolicy?.generation
      || nextPolicy?.documentId !== contextPolicy?.documentId) {
      contextPolicy = nextPolicy;
      agentContext = createAgentContext({ dataPolicy: nextPolicy, sessionId, currentPolicy: adapterOptions.getDataPolicy });
    }
    return agentContext;
  };
  adapterOptions.agentContext = agentContext;
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
