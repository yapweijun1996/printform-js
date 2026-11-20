import { AGENT_OPERATION_DEFINITIONS, OPERATION_DEFINITIONS } from "./operation-schemas.js";

// Public catalog projection. The executable schema remains the one in
// operation-schemas.js; this function only removes internal metadata and
// returns fresh values so a caller cannot mutate the SSOT through a response.
function projectCatalog(definitions) {
  return Object.entries(definitions).map(([type, definition]) => ({
    type,
    description: definition.description,
    inputSchema: structuredClone(definition.schema),
    example: structuredClone(definition.example),
    risk: definition.risk
  }));
}

export function getOperationCatalog() { return projectCatalog(AGENT_OPERATION_DEFINITIONS); }
export function getAllOperationCatalog() { return projectCatalog(OPERATION_DEFINITIONS); }
export const getAgentOperationCatalog = getOperationCatalog;
