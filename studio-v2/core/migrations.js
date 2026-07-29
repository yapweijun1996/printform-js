import { PROTOCOL_VERSION, protocolMajor } from "./constants.js";
import { cloneProject, diffProjects } from "./operations.js";

export function analyzeMigration(project) {
  const current = PROTOCOL_VERSION;
  const source = project.manifest.protocolVersion || "0.0.0";
  if (source === current) return { action: "none", source, target: current, candidate: project, diff: { changed: false, changedSections: [] } };
  if (protocolMajor(source) !== protocolMajor(current)) return { action: "read-only", source, target: current, reason: "Cross-major migration requires an explicit migrator" };
  const candidate = cloneProject(project);
  candidate.manifest.protocolVersion = current;
  candidate.attestation = null;
  return { action: "preview", source, target: current, candidate, diff: diffProjects(project, candidate) };
}
