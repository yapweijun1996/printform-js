export const PROTOCOL_VERSION = "2.0.0";
export const AGENT_CONTRACT_VERSION = "1.1.0";
export const RUNTIME_GLOBAL = "PrintFormDocument";

export const SECTION_IDS = Object.freeze({
  manifest: "pf-manifest",
  schema: "pf-schema",
  i18n: "pf-i18n",
  theme: "pf-theme",
  template: "pf-template",
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
