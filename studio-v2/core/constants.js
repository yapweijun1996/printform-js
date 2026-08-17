export const PROTOCOL_VERSION = "2.0.0";
// 2.0.0 (2026-07-31): BREAKING. complete_layout_review now requires
// evidenceIds issued by capture_layout_evidence and rejects the old
// self-declared evidence/browser/scenarios labels (TASK.md #18) — keeping
// that path would leave agents able to claim a review they never did, which
// is the whole point of the change. 1.2.0 added real candidate rendering and
// candidateHash additively (TASK.md #12-14).
// 3.0.0 (2026-08-17): BREAKING. Agent writes now use the semantic operation
// allowlist and an explicit preview -> approval -> commit transaction;
// apply_changes no longer accepts operations[] directly and raw source
// preview is kept as a Studio-internal command rather than an Agent tool.
export const AGENT_CONTRACT_VERSION = "3.0.0";

// Studio v2's own SemVer line, independent of the Protocol and Agent Contract
// versions above (which describe the FILE FORMAT and the COMMAND SURFACE — a
// Studio UI change must not force either of those to move, and vice versa).
// See docs/COMPATIBILITY_MATRIX.zh-CN.md for how the four lines relate.
//
// 0.11.0 (2026-08-17): FormSpec registry, active-table diagnostics, safe
// Agent transactions, strict trusted export checks and persistent evidence.
// 0.10.0 (2026-08-04): embedded AI Designer panel and Contract 2.1 gateway.
// 0.9.0 (2026-07-31): first declared version, deliberately below 1.0.0 while
// maturity is Production Pilot. Bumping to 1.0.0 is reserved for the moment a
// maintainer explicitly declares Production Ready — the version number should
// not be able to claim a maturity the project has not announced.
export const STUDIO_VERSION = "0.11.0";
export const RUNTIME_GLOBAL = "PrintFormDocument";

export const SECTION_IDS = Object.freeze({
  manifest: "pf-manifest",
  schema: "pf-schema",
  i18n: "pf-i18n",
  theme: "pf-theme",
  template: "pf-template",
  formSpec: "pf-form-spec",
  sampleData: "pf-sample-data",
  attestation: "pf-attestation"
});

export const LIMITS = Object.freeze({
  htmlBytes: 10 * 1024 * 1024,
  rows: 500,
  logicalPages: 100
});

export const SAFE_URL_PROTOCOLS = Object.freeze(["http:", "https:", "mailto:", "tel:"]);

export const TRUST = Object.freeze({
  trusted: "trusted",
  untrusted: "untrusted"
});

export function protocolMajor(version) {
  return Number.parseInt(String(version || "0").split(".")[0], 10) || 0;
}
