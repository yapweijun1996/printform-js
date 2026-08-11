import { OPERATION_DEFINITIONS } from "./operation-schemas.js";

// Public catalog projection. The executable schema remains the one in
// operation-schemas.js; this function only removes internal metadata and
// returns fresh values so a caller cannot mutate the SSOT through a response.
export function getOperationCatalog() {
  return Object.entries(OPERATION_DEFINITIONS).map(([type, definition]) => ({
    type,
    description: definition.description,
    inputSchema: structuredClone(definition.schema),
    example: structuredClone(definition.example),
    risk: definition.risk
  }));
}
