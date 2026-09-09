import { expect, test } from "@playwright/test";
import { CdpStudioClient } from "../mcp/cdp-client.mjs";
import { admitPublicGateway, openInspector } from "./studio-v2-helpers.js";

test.describe.configure({ timeout: 180_000 });

function code(response) {
  return response?.error?.code || response?.structuredContent?.error?.code || null;
}

async function runCdpDirectApply(page) {
  const transport = await page.context().newCDPSession(page);
  const client = new CdpStudioClient({ origins: ["http://127.0.0.1:4174"] });
  client.send = (method, params = {}) => transport.send(method, params);
  try {
    const preview = await client.execute("preview_changes", {
      expectedRevision: 0,
      operations: [{ type: "set_font_scale", basePt: 10 }],
    });
    const input = {
      expectedRevision: 0,
      transactionId: preview.result.transactionId,
      expectedCandidateHash: preview.result.candidateHash,
      requireValid: false,
      humanApproval: true,
      approvedByUser: true,
      approvalToken: "forged-cdp-approval",
    };
    const approve = await client.execute("approve_transaction", input);
    const apply = await client.execute("apply_changes", input);
    return { approve: code(approve), apply: code(apply), revision: (await client.execute("get_revision")).result.revision };
  } finally {
    client.close();
    await transport.detach().catch(() => {});
  }
}

test.describe("Studio v2 PROD-02 02-03 approval bypass and provenance", () => {
  test("keeps approval private and rejects forged, mismatched, expired and stale paths", async ({ page, browserName }) => {
    const browserErrors = [];
    const browserDiagnostics = [];
    const knownFirefoxAgrunCspDiagnostic = (message) => browserName === "firefox"
      && /Content-Security-Policy:[\s\S]*blocked a JavaScript eval[\s\S]*agrun\.min\.js/i.test(message);
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") browserDiagnostics.push(message.text()); });

    await page.goto("/studio-v2/?sample=sales-invoice");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await openInspector(page);
    await page.locator("#ai-designer-tab").click();
    await admitPublicGateway(page);

    await page.evaluate(async () => {
      const { CommandBus } = await import("/studio-v2/core/command-bus.js");
      const { bindAgentSession, installAgentGateway } = await import("/studio-v2/adapters/gateway.js");
      const { installWebMcpAdapter } = await import("/studio-v2/adapters/webmcp.js");
      const { classifySyntheticDocument } = await import("/studio-v2/core/data-policy.js");
      const { createSalesInvoiceProject } = await import("/studio-v2/samples/sales-invoice.js");
      const policy = classifySyntheticDocument("p0-prod02-03-boundary");
      const bus = new CommandBus(createSalesInvoiceProject(), { dataPolicy: policy });
      const originalGateway = window.PrintFormStudioAgent;
      const options = {
        getDataPolicy: () => policy,
        getScopeContext: () => ({ kind: "document" }),
        getApplyMode: () => "preview",
        sessionId: "p0-prod02-03-global",
      };
      const gateway = installAgentGateway(bus, window, options);
      const ordinary = bindAgentSession(gateway, "p0-prod02-03-ordinary");
      const webTools = [];
      const webAdapter = installWebMcpAdapter(bus, {
        modelContext: { registerTool(tool) { webTools.push(tool); } },
      }, { ...options, sessionId: "p0-prod02-03-webmcp" });
      let uiFactory;
      const uiGateway = installAgentGateway(bus, {}, {
        ...options,
        sessionId: "p0-prod02-03-ui-host",
        onUiSessionFactory: (factory) => { uiFactory = factory; },
      });
      window.__p0Prod0203 = { bus, gateway, ordinary, webTools, webAdapter, originalGateway, policy, uiGateway, uiFactory };
    });

    let entryResults;
    let cdpResults = null;
    try {
      entryResults = await page.evaluate(async () => {
        const control = window.__p0Prod0203;
        const input = { expectedRevision: 0, operations: [{ type: "set_brand_color", hex: "#854d0e" }] };
        const directAttempt = async (session, unwrap = (result) => result) => {
          const preview = unwrap(await session.execute("preview_changes", input));
          const command = {
            expectedRevision: 0,
            transactionId: preview.result.transactionId,
            expectedCandidateHash: preview.result.candidateHash,
            requireValid: false,
            humanApproval: true,
            approvedByUser: true,
            approvalToken: "forged-agent-approval",
          };
          const approve = unwrap(await session.execute("approve_transaction", command));
          const apply = unwrap(await session.execute("apply_changes", command));
          return { approve: approve.error?.code || null, apply: apply.error?.code || null };
        };
        const web = (name) => control.webTools.find((tool) => tool.name === name);
        const webSession = { execute: async (name, value) => (await web(name).execute(value)).structuredContent };
        return {
          surfaces: {
            pageGlobalHuman: typeof control.gateway.executeHuman,
            ordinaryBoundHuman: typeof control.ordinary.executeHuman,
            webMcpHuman: typeof control.webTools.find((tool) => tool.name === "apply_changes").executeHuman,
            webMcpToolCount: control.webTools.length,
          },
          global: await directAttempt(control.gateway),
          ordinary: await directAttempt(control.ordinary),
          webmcp: await directAttempt(webSession),
          revision: control.bus.revision,
        };
      });
      if (browserName === "chromium") cdpResults = await runCdpDirectApply(page);

      const uiResults = await page.evaluate(async () => {
        const control = window.__p0Prod0203;
        const { CommandBus } = await import("/studio-v2/core/command-bus.js");
        const { installAgentGateway } = await import("/studio-v2/adapters/gateway.js");
        const { DesignerRuntimeController } = await import("/studio-v2/ui/agent-runtime.js");
        const { createSalesInvoiceProject } = await import("/studio-v2/samples/sales-invoice.js");
        const profile = { id: "p0-prod02-03", provider: "openai", model: "gpt-test", apiKey: "memory-only" };
        const ui = control.uiFactory("p0-prod02-03-ui");
        const hashPreview = await ui.execute("preview_changes", { expectedRevision: control.bus.revision, operations: [{ type: "set_brand_color", hex: "#713f12" }] });
        const hashMismatch = await ui.executeHuman("approve_transaction", {
          expectedRevision: control.bus.revision,
          transactionId: hashPreview.result.transactionId,
          expectedCandidateHash: `sha256:${"0".repeat(64)}`,
          requireValid: false,
        });
        const staleFirst = await ui.execute("preview_changes", { expectedRevision: control.bus.revision, operations: [{ type: "set_font_scale", basePt: 10 }] });
        const staleSecond = await ui.execute("preview_changes", { expectedRevision: control.bus.revision, operations: [{ type: "set_brand_color", hex: "#166534" }] });
        await ui.executeHuman("approve_transaction", { expectedRevision: control.bus.revision, transactionId: staleSecond.result.transactionId, expectedCandidateHash: staleSecond.result.candidateHash, requireValid: false });
        await ui.executeHuman("apply_changes", { expectedRevision: control.bus.revision, transactionId: staleSecond.result.transactionId, expectedCandidateHash: staleSecond.result.candidateHash, requireValid: false });
        const staleRevision = await ui.executeHuman("approve_transaction", { expectedRevision: 0, transactionId: staleFirst.result.transactionId, expectedCandidateHash: staleFirst.result.candidateHash, requireValid: false });

        let current = new Date("2026-09-08T00:00:00.000Z");
        const expiredBus = new CommandBus(createSalesInvoiceProject(), { dataPolicy: control.policy, clock: () => current, leaseDurationMs: 1_000 });
        let expiredFactory;
        installAgentGateway(expiredBus, {}, {
          getDataPolicy: () => control.policy,
          getScopeContext: () => ({ kind: "document" }),
          getApplyMode: () => "preview",
          sessionId: "p0-prod02-03-expired-host",
          onUiSessionFactory: (factory) => { expiredFactory = factory; },
        });
        const expiredUi = expiredFactory("p0-prod02-03-expired-ui");
        const expiredPreview = await expiredUi.execute("preview_changes", { expectedRevision: 0, operations: [{ type: "set_font_scale", basePt: 10 }] });
        current = new Date(current.getTime() + 2_000);
        const expired = await expiredUi.executeHuman("approve_transaction", { expectedRevision: 0, transactionId: expiredPreview.result.transactionId, expectedCandidateHash: expiredPreview.result.candidateHash, requireValid: false });

        const fakeSession = { getState: () => ({ cumulativeUsage: { totalTokens: 0 } }) };
        const Agrun = {
          defineAction: (definition) => definition,
          createRuntime: () => ({ createSession: async () => fakeSession, openSession: async () => fakeSession, getAgentSkills: () => [] }),
          openaiBrowserSkill: {},
          geminiBrowserSkill: {},
        };
        const controller = await DesignerRuntimeController.create({
          Agrun,
          gateway: ui,
          sessionManager: { createStore: () => ({}) },
          sessionId: "p0-prod02-03-ui",
          profile,
          dataPolicy: control.policy,
          getDataPolicy: () => control.policy,
        });
        const proposalText = (hex) => JSON.stringify({ expectedRevision: control.bus.revision, operations: [{ type: "set_brand_color", hex }] });
        await controller.recoverTextProposal(proposalText("#92400e"));
        const tamperedId = controller.pendingProposal.proposalId;
        controller.proposals.get(tamperedId).approvalToken = "tampered-approval-capability";
        let tamperedCapability;
        try { await controller.applyApprovedProposal(tamperedId, profile, { humanApproval: true }); }
        catch (error) { tamperedCapability = error.code; }
        const revisionAfterTamper = control.bus.revision;
        await controller.recoverTextProposal(proposalText("#0f766e"));
        const valid = await controller.applyApprovedProposal(controller.pendingProposal.proposalId, profile, { humanApproval: true });
        return {
          uiHasHuman: typeof ui.executeHuman,
          hashMismatch: hashMismatch.error?.code || null,
          staleRevision: staleRevision.error?.code || null,
          expired: expired.error?.code || null,
          tamperedCapability,
          revisionAfterTamper,
          validApplyRevision: valid.applied.result.revision,
          finalRevision: control.bus.revision,
        };
      });
      entryResults.ui = uiResults;

      expect(entryResults.surfaces).toMatchObject({ pageGlobalHuman: "undefined", ordinaryBoundHuman: "undefined", webMcpHuman: "undefined", webMcpToolCount: 35 });
      for (const entry of [entryResults.global, entryResults.ordinary, entryResults.webmcp]) expect(entry).toEqual({ approve: "HUMAN_APPROVAL_REQUIRED", apply: "HUMAN_APPROVAL_REQUIRED" });
      expect(entryResults.revision).toBe(0);
      if (cdpResults) expect(cdpResults).toEqual({ approve: "HUMAN_APPROVAL_REQUIRED", apply: "HUMAN_APPROVAL_REQUIRED", revision: 0 });
      expect(entryResults.ui).toMatchObject({ uiHasHuman: "function", hashMismatch: "CANDIDATE_HASH_MISMATCH", staleRevision: "REVISION_CONFLICT", expired: "LEASE_EXPIRED", tamperedCapability: "APPROVAL_TOKEN_INVALID", revisionAfterTamper: 1, validApplyRevision: 2, finalRevision: 2 });
      expect(browserErrors).toEqual([]);
      expect(browserDiagnostics.filter((message) => !knownFirefoxAgrunCspDiagnostic(message))).toEqual([]);
      if (browserDiagnostics.some(knownFirefoxAgrunCspDiagnostic)) test.info().annotations.push({
        type: "known-browser-diagnostic",
        description: "Firefox reports the existing AGRUN CSP eval diagnostic; no functional page error was observed.",
      });
    } finally {
      await page.evaluate(() => {
        const control = window.__p0Prod0203;
        control?.webAdapter.dispose();
        if (control?.originalGateway) Object.defineProperty(window, "PrintFormStudioAgent", { configurable: true, value: control.originalGateway });
        delete window.__p0Prod0203;
      });
    }
  });
});
