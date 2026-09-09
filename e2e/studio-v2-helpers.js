import { AGENT_CONTRACT_VERSION, PROTOCOL_VERSION } from "../studio-v2/core/constants.js";
import { TOOL_CONTRACTS } from "../studio-v2/core/tool-contracts.js";

const ADMISSION_REQUEST = Object.freeze({
  protocolVersion: PROTOCOL_VERSION,
  contractVersion: AGENT_CONTRACT_VERSION,
  tools: TOOL_CONTRACTS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))
});

export async function admitPublicGateway(page) {
  await page.waitForFunction(() => typeof window.PrintFormStudioAgent?.admitClient === "function");
  const result = await page.evaluate((request) => window.PrintFormStudioAgent.admitClient(request), ADMISSION_REQUEST);
  if (!result?.ok) throw new Error(`Public Agent gateway admission failed: ${result?.error?.code || "unknown"}`);
  return result.result.admissionId;
}

export async function passLayoutReview(page) {
  return page.evaluate(async () => {
    const summary = await window.PrintFormStudioAgent.execute("get_project_summary");
    const expectedRevision = summary.result.revision;
    // Each scenario must be rendered and signed before a review is accepted.
    const evidenceIds = [];
    for (const scenario of ["default", "long-text"]) {
      const captured = await window.PrintFormStudioAgent.execute("capture_layout_evidence", { expectedRevision, scenario });
      if (!captured.ok) throw new Error(`capture_layout_evidence(${scenario}) failed: ${captured.error.code}`);
      if (!captured.result.evidence) throw new Error(`Scenario ${scenario} did not render cleanly: ${JSON.stringify(captured.result.validation.errors)}`);
      evidenceIds.push(captured.result.evidence.evidenceId);
    }
    await window.PrintFormStudioAgent.execute("begin_layout_review", { expectedRevision });
    return window.PrintFormStudioAgent.execute("complete_layout_review", {
      expectedRevision, reviewer: "ai-agent", evidenceIds,
      findings: [], summary: "Automated browser invariants and full-page fixture reviewed"
    });
  });
}

export async function openInspector(page) {
  if (await page.locator("#inspector-panel").getAttribute("aria-hidden") === "true") {
    await page.locator("#inspector-toggle").click();
  }
}

export async function openEditor(page) {
  if (await page.locator("#editor-panel").getAttribute("aria-hidden") === "true") {
    await page.locator("#editor-toggle").click();
  }
}
