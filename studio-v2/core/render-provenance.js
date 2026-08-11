import { sha256, stableStringify } from "./json.js";

export const RENDER_PROVENANCE_VERSION = 1;

export async function hashRenderProject(project) {
  return sha256(stableStringify(project));
}

export function attachRenderProvenance(report, provenance) {
  return {
    ...structuredClone(report),
    provenance: {
      version: RENDER_PROVENANCE_VERSION,
      revision: provenance.revision,
      candidateHash: provenance.candidateHash,
      baseProjectHash: provenance.baseProjectHash,
      source: provenance.source,
      ...(provenance.scenario ? { scenario: provenance.scenario } : {}),
      ...(provenance.visualMode ? { visualMode: provenance.visualMode } : {}),
      ...(Number.isInteger(provenance.token) ? { token: provenance.token } : {})
    }
  };
}

export function hasRenderProvenance(report, source) {
  const value = report?.provenance;
  return Boolean(value
    && value.version === RENDER_PROVENANCE_VERSION
    && Number.isInteger(value.revision)
    && typeof value.candidateHash === "string"
    && typeof value.baseProjectHash === "string"
    && (!source || value.source === source));
}

export async function verifyCurrentRender(report, project, revision) {
  if (!hasRenderProvenance(report, "committed")) {
    return { ok: false, code: "RENDER_PROVENANCE_REQUIRED", message: "The current render is missing Studio provenance" };
  }
  const expectedHash = await hashRenderProject(project);
  const value = report.provenance;
  if (value.revision !== revision || value.baseProjectHash !== expectedHash || value.candidateHash !== expectedHash) {
    return { ok: false, code: "RENDER_PROVENANCE_STALE", message: "The current render no longer matches the committed project" };
  }
  return { ok: true, projectHash: expectedHash };
}

export function provenanceError(result) {
  return { code: result.code, message: result.message, path: "/renderReport", severity: "error" };
}
