// Compatibility exports for existing UI consumers. Agent boundary projection
// is implemented in the closed per-command projector modules.
import { createAgentContext } from "./agent-context.js";
import { projectValidation, projectMetrics, projectIssue, projectGeometry, projectPixels } from "./agent-output-primitives.js";
export {
  sanitizeAgentResult,
  sanitizeAgentResponse,
  projectAgentResult,
  projectAgentError,
} from "./agent-output-projectors.js";
const compatibilityContext = () => createAgentContext({ dataPolicy: { allowPixelEvidence: true } });
export function sanitizeValidation(value) { return projectValidation(value, compatibilityContext(), false); }
export function sanitizeMetrics(value) { return projectMetrics(value); }
export function sanitizeIssue(value) { return projectIssue(value, compatibilityContext()); }
export function sanitizeSnapshot(value) { return projectGeometry(value); }
export function sanitizePixelSnapshot(value, realData = false) {
  return realData ? undefined : projectPixels(value, compatibilityContext());
}
