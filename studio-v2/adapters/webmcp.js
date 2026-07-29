import { TOOL_CONTRACTS } from "../core/tool-contracts.js";
import { executeAgentCommand } from "./gateway.js";

export function installWebMcpAdapter(bus, doc = document) {
  const modelContext = doc.modelContext;
  if (!modelContext?.registerTool) return { supported: false, registered: [], dispose() {} };
  const controller = new AbortController();
  const registered = [];
  TOOL_CONTRACTS.forEach((contract) => {
    try {
      modelContext.registerTool({
        name: contract.name,
        description: contract.description,
        inputSchema: contract.inputSchema,
        async execute(input = {}) {
          const response = await executeAgentCommand(bus, contract.name, input);
          return {
            content: [{ type: "text", text: JSON.stringify(response) }],
            structuredContent: response,
            isError: !response.ok
          };
        }
      }, { signal: controller.signal });
      registered.push(contract.name);
    } catch (error) {
      console.warn(`WebMCP registration failed for ${contract.name}`, error);
    }
  });
  return { supported: registered.length > 0, registered, dispose: () => controller.abort() };
}
