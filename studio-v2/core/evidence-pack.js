import { PROTOCOL_VERSION } from "./constants.js";
import { getFormSpec } from "./form-spec.js";
import { sha256, stableStringify } from "./json.js";

export async function createEvidencePack({
  project,
  revision = null,
  validation,
  previewHash = null,
  html = "",
  runtimeVersion = "unknown",
  runtimeHash = "",
  printformRuntimeHash = "",
  security = null,
  transactionId = null,
  timestamp = new Date().toISOString(),
}) {
  const specHash = await sha256(stableStringify(getFormSpec(project)));
  const exportHtmlHash = html ? await sha256(html) : null;
  const pack = {
    artifactType: "printform",
    protocolVersion: PROTOCOL_VERSION,
    schemaVersion: project.manifest?.schemaVersion || "1.0.0",
    runtimeVersion,
    documentType: project.manifest?.documentType || "printform",
    revision,
    transactionId,
    formSpecHash: `sha256:${specHash}`,
    validation: {
      status: validation?.productionValid ? "PASS" : "FAIL",
      pageCount: validation?.metrics?.logicalPages || 0,
      errorCount: validation?.errors?.length || 0,
    },
    pageCount: validation?.metrics?.logicalPages || 0,
    previewHash,
    exportHtmlHash: exportHtmlHash ? `sha256:${exportHtmlHash}` : null,
    exportHtmlHashScope: "html-with-embedded-export-hash-redacted",
    runtimeHash: runtimeHash ? `sha256:${runtimeHash}` : null,
    printformRuntimeHash: printformRuntimeHash ? `sha256:${printformRuntimeHash}` : null,
    security: {
      externalNetwork: Boolean(security?.externalNetwork),
      arbitraryJavascript: Boolean(security?.arbitraryJavascript),
      status: security?.valid === true ? "PASS" : "FAIL",
    },
    timestamp,
  };
  pack.hash = `sha256:${await sha256(stableStringify(pack))}`;
  return pack;
}

export function evidenceSummary(pack) {
  if (!pack) return null;
  return {
    artifactType: pack.artifactType,
    revision: pack.revision,
    formSpecHash: pack.formSpecHash,
    validation: pack.validation,
    pageCount: pack.pageCount,
    previewHash: pack.previewHash,
    exportHtmlHash: pack.exportHtmlHash,
    exportHtmlHashScope: pack.exportHtmlHashScope,
    runtimeVersion: pack.runtimeVersion,
    runtimeHash: pack.runtimeHash,
    printformRuntimeHash: pack.printformRuntimeHash,
    security: pack.security,
    timestamp: pack.timestamp,
    transactionId: pack.transactionId || null,
  };
}
