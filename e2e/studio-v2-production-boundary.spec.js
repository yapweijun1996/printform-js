import { expect, test } from "@playwright/test";
import { admitPublicGateway, openEditor } from "./studio-v2-helpers.js";
import { readClientStorage } from "./studio-v2-storage-inspection.js";
test.describe("Studio v2 production boundary", () => {
  test("requires human approval for direct Agent document mutations", async ({ page }) => {
    await page.goto("/studio-v2/");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    const beforeAdmission = await page.evaluate(() => window.PrintFormStudioAgent.execute("get_project_summary"));
    expect(beforeAdmission).toMatchObject({ ok: false, error: { code: "CLIENT_NOT_ADMITTED" } });
    await admitPublicGateway(page);
    const result = await page.evaluate(async () => {
      const run = (name, input) => window.PrintFormStudioAgent.execute(name, input);
      const initial = await run("get_revision", {});
      const blockedLocale = await run("set_locale", { expectedRevision: 0, locale: "zh-CN" });
      const blockedUndo = await run("undo_revision", { expectedRevision: 0 });
      const publicHumanCapability = typeof window.PrintFormStudioAgent.executeHuman;
      const current = await run("get_revision", {});
      return { initial, blockedLocale, blockedUndo, publicHumanCapability, current, toolCount: window.PrintFormStudioAgent.listTools().length };
    });
    expect(result.toolCount).toBe(35);
    expect(result.initial.result.revision).toBe(0);
    expect(result.blockedLocale.error.code).toBe("HUMAN_APPROVAL_REQUIRED");
    expect(result.blockedUndo.error.code).toBe("HUMAN_APPROVAL_REQUIRED");
    expect(result.publicHumanCapability).toBe("undefined");
    expect(result.current.result.revision).toBe(0);
  });

  test("defaults unconfigured Agent adapters to Unknown before storage or pixels", async ({ page }) => {
    await page.goto("/studio-v2/");
    await page.evaluate(async () => {
      await Promise.all((await navigator.serviceWorker?.getRegistrations?.() || []).map((registration) => registration.unregister()));
      if (typeof caches !== "undefined") await Promise.all((await caches.keys()).map((name) => caches.delete(name)));
    });
    await page.reload();
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    const result = await page.evaluate(async () => {
      const { CommandBus } = await import("/studio-v2/core/command-bus.js");
      const { installAgentGateway } = await import("/studio-v2/adapters/gateway.js");
      const { installWebMcpAdapter } = await import("/studio-v2/adapters/webmcp.js");
      const { createSalesInvoiceProject } = await import("/studio-v2/samples/sales-invoice.js");
      const bus = new CommandBus(createSalesInvoiceProject(), { transactionStorage: localStorage });
      const gateway = installAgentGateway(bus, {});
      const tools = [];
      const webMcp = installWebMcpAdapter(bus, { modelContext: { registerTool(tool) { tools.push(tool); } } });
      const before = Object.keys(localStorage).filter((key) => key.startsWith("printform:"));
      const gatewayCapabilities = await gateway.execute("get_capabilities");
      const gatewayPixels = await gateway.execute("capture_layout_evidence", { expectedRevision: 0, scenario: "default", visualMode: "pixels" });
      const webPixels = await tools.find((tool) => tool.name === "capture_layout_evidence").execute({ expectedRevision: 0, scenario: "default", visualMode: "pixels" });
      const after = Object.keys(localStorage).filter((key) => key.startsWith("printform:"));
      webMcp.dispose();
      return { classification: bus.dataPolicy.classification, persistent: bus.transactionStore.persistent, gatewayCapabilities, gatewayPixels, webPixels, before, after };
    });
    expect(result.classification).toBe("unknown");
    expect(result.persistent).toBe(false);
    expect(result.gatewayCapabilities.result.capabilities.durableTransactions).toBe(false);
    expect(result.gatewayPixels.error.code).toBe("PIXEL_EVIDENCE_SYNTHETIC_ONLY");
    expect(result.webPixels.structuredContent.error.code).toBe("PIXEL_EVIDENCE_SYNTHETIC_ONLY");
    expect(result.after).toEqual(result.before);
  });

  test("reports a quota fallback while keeping the current synthetic edit in memory", async ({ page }) => {
    await page.addInitScript(() => {
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (String(key).startsWith("printform:studio-v2:transactions:")) throw new DOMException("quota exceeded", "QuotaExceededError");
        return setItem.call(this, key, value);
      };
    });
    await page.goto("/studio-v2/");
    await expect(page.locator("#data-policy")).toHaveText(/Persistence unavailable|持久化不可用|Kegigihan tidak tersedia|永続化を利用できません|Không có lưu trữ bền vững/i);

    const result = await page.evaluate(async () => ({
      capabilities: (await window.PrintFormStudioAgent.execute("get_capabilities")).result.capabilities,
      policy: document.querySelector("#data-policy").textContent
    }));

    expect(result.capabilities.durableTransactions).toBe(false);
    expect(result.policy).toMatch(/Persistence unavailable|持久化不可用|Kegigihan tidak tersedia|永続化を利用できません|Không có lưu trữ bền vững/i);
  });

  test("keeps real-data transactions out of browser durable storage", async ({ page }) => {
    await page.goto("/studio-v2/");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await openEditor(page);
    await page.locator("label.privacy-toggle").click();
    await expect(page.locator("#data-policy")).toHaveText(/Real data|真实数据/i);
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await admitPublicGateway(page);
    const result = await page.evaluate(async () => {
      const run = (name, input) => window.PrintFormStudioAgent.execute(name, input);
      const before = Object.keys(localStorage).filter((key) => key.startsWith("printform:"));
      const transaction = await run("begin_transaction", { baseRevision: 0, agentId: "canary-agent", owner: "canary-owner" });
      const preview = await run("preview_changes", { expectedRevision: 0, operations: [{ type: "set_brand_color", hex: "#854d0e" }] });
      const after = Object.keys(localStorage).filter((key) => key.startsWith("printform:"));
      return { transaction, preview, before, after };
    });
    expect(result.transaction.ok).toBe(true);
    expect(result.preview.ok).toBe(true);
    expect(result.transaction.result.transaction_id).toMatch(/^ref:transaction:/);
    expect(result.preview.result.transactionId).toMatch(/^ref:transaction:/);
    expect(result.after).toEqual(result.before);
  });

  test("keeps an imported unknown canary volatile across mode changes and reload", async ({ page, request }) => {
    const fixture = await request.get("/studio-v2/samples/sales-invoice-v2.html");
    expect(fixture.ok()).toBe(true);
    await page.goto("/studio-v2/");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await page.locator("#import-file").setInputFiles({
      name: "unknown-canary.html", mimeType: "text/html", buffer: await fixture.body()
    });
    await expect(page.locator("#data-policy")).toHaveText(/Unknown data|restrictive|未知数据/i);
    await openEditor(page);
    await page.locator("label.privacy-toggle").click();
    await expect(page.locator("#data-policy")).toHaveText(/Real data|真实数据/i);
    await admitPublicGateway(page);

    const before = await readClientStorage(page);
    const result = await page.evaluate(async () => {
      const canary = "CANARY-REAL-20260907";
      const run = (name, input) => window.PrintFormStudioAgent.execute(name, input);
      const transaction = await run("begin_transaction", { baseRevision: 0, agentId: canary, owner: canary });
      const preview = await run("preview_changes", { expectedRevision: 0, operations: [{ type: "set_brand_color", hex: "#a1b2c3" }] });
      const pixels = await run("capture_layout_evidence", { expectedRevision: 0, scenario: "default", visualMode: "pixels" });
      return { transaction, preview, pixels };
    });
    const after = await readClientStorage(page);
    expect(result.transaction.ok).toBe(true);
    expect(result.preview.ok).toBe(true);
    expect(result.pixels.error.code).toBe("PIXEL_EVIDENCE_SYNTHETIC_ONLY");
    expect(after).toEqual(before);
    expect(JSON.stringify(after)).not.toContain("CANARY-REAL-20260907");

    await page.reload();
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await admitPublicGateway(page);
    const reloaded = await page.evaluate(async () => ({
      summary: await window.PrintFormStudioAgent.execute("get_project_summary"),
      recoveryVisible: !document.querySelector("#restore-banner")?.classList.contains("hidden")
    }));
    const reloadedStorage = await readClientStorage(page);
    expect(reloaded.summary.result.revision).toBe(0);
    expect(reloaded.recoveryVisible).toBe(false);
    expect(JSON.stringify(reloadedStorage)).not.toContain("CANARY-REAL-20260907");
  });

  test("checks the final real-data Provider payload, not only gateway responses", async ({ page }) => {
    await page.goto("/studio-v2/");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await openEditor(page);
    await page.locator("label.privacy-toggle").click();
    await expect(page.locator("#data-policy")).toHaveText(/Real data|真实数据/i);
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await admitPublicGateway(page);
    const result = await page.evaluate(async () => {
      const { DesignerRuntimeController } = await import("/studio-v2/ui/agent-runtime.js");
      const { classifyRealDocument } = await import("/studio-v2/core/data-policy.js");
      const dataPolicy = classifyRealDocument();
      let runtimeOptions;
      let providerInput;
      const session = {
        getState: () => ({ cumulativeUsage: { totalTokens: 0 } }),
        runStream(input) {
          providerInput = input;
          return (async function* () {
            const actions = new Map(runtimeOptions.customActions.map((action) => [action.name, action]));
            await actions.get("printform_complete_current_layout_review").execute({}, { findings: [], summary: "Controlled real-data payload check" });
            yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: "done" } } } };
          }());
        }
      };
      const Agrun = {
        defineAction: (definition) => definition,
        createRuntime: (options) => {
          runtimeOptions = options;
          return { createSession: async () => session, openSession: async () => session, getAgentSkills: () => [] };
        },
        openaiBrowserSkill: {}, geminiBrowserSkill: {}
      };
      const profile = { id: "real-payload", provider: "openai", model: "mock-vision", apiKey: "memory-only" };
      const controller = await DesignerRuntimeController.create({
        Agrun, gateway: window.PrintFormStudioAgent, sessionManager: { createStore: () => ({}) },
        sessionId: crypto.randomUUID(), profile, realData: true, dataPolicy, getDataPolicy: () => dataPolicy
      });
      const outcome = await controller.reviewLayout(profile);
      return {
        terminal: outcome.completed.terminalKind,
        prompt: providerInput?.prompt || "",
        parts: providerInput?.parts || []
      };
    });
    expect(result.terminal).toBe("done");
    expect(result.prompt).not.toContain("CANARY-REAL-20260907");
    expect(result.parts.length).toBeGreaterThan(0);
    expect(result.parts.every((part) => part.mimeType === "image/svg+xml" && part.url.startsWith("data:image/svg+xml"))).toBe(true);
  });

  test("rejects a delayed Provider result after a data-mode switch", async ({ page }) => {
    await page.goto("/studio-v2/");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await openEditor(page);
    await admitPublicGateway(page);
    const result = await page.evaluate(async () => {
      const { DesignerRuntimeController } = await import("/studio-v2/ui/agent-runtime.js");
      const { classifyRealDocument, classifySyntheticDocument } = await import("/studio-v2/core/data-policy.js");
      const synthetic = classifySyntheticDocument("delayed-browser-doc");
      const real = classifyRealDocument("delayed-browser-doc");
      const policyState = { current: synthetic };
      let release;
      let markStarted;
      const started = new Promise((resolve) => { markStarted = resolve; });
      const session = {
        getState: () => ({ cumulativeUsage: { totalTokens: 0 } }),
        runStream() {
          return (async function* () {
            markStarted();
            await new Promise((resolve) => { release = resolve; });
            yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: "CANARY-STALE-RESULT" } } } };
          }());
        }
      };
      const Agrun = {
        defineAction: (definition) => definition,
        createRuntime: () => ({ createSession: async () => session, openSession: async () => session, getAgentSkills: () => [] }),
        openaiBrowserSkill: {}, geminiBrowserSkill: {}
      };
      const profile = { id: "delayed-boundary", provider: "openai", model: "mock", apiKey: "memory-only" };
      const controller = await DesignerRuntimeController.create({
        Agrun, gateway: window.PrintFormStudioAgent, sessionManager: { createStore: () => ({}) },
        sessionId: crypto.randomUUID(), profile, dataPolicy: synthetic, getDataPolicy: () => policyState.current
      });
      const pending = controller.run("delayed boundary check", profile);
      await started;
      document.querySelector("label.privacy-toggle")?.click();
      policyState.current = real;
      release();
      return pending;
    });
    await expect(page.locator("#data-policy")).toHaveText(/Real data|真实数据/i);
    expect(result.errorReported).toBe(true);
    expect(result.completed).toMatchObject({ terminalKind: "error", error: { code: "STALE_POLICY_CONTEXT" } });
    expect(result.result).toBeNull();
    expect(JSON.stringify(result)).not.toContain("CANARY-STALE-RESULT");
  });

  test("rejects a delayed Provider result after switching documents", async ({ page }) => {
    await page.goto("/studio-v2/");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await openEditor(page);
    await admitPublicGateway(page);
    const result = await page.evaluate(async () => {
      const { DesignerRuntimeController } = await import("/studio-v2/ui/agent-runtime.js");
      const { classifySyntheticDocument } = await import("/studio-v2/core/data-policy.js");
      const first = classifySyntheticDocument("document-a");
      const second = classifySyntheticDocument("document-b");
      const policyState = { current: first };
      let release;
      let markStarted;
      const started = new Promise((resolve) => { markStarted = resolve; });
      const session = {
        getState: () => ({ cumulativeUsage: { totalTokens: 0 } }),
        runStream() {
          return (async function* () {
            markStarted();
            await new Promise((resolve) => { release = resolve; });
            yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: "CANARY-WRONG-DOCUMENT" } } } };
          }());
        }
      };
      const Agrun = {
        defineAction: (definition) => definition,
        createRuntime: () => ({ createSession: async () => session, openSession: async () => session, getAgentSkills: () => [] }),
        openaiBrowserSkill: {}, geminiBrowserSkill: {}
      };
      const profile = { id: "cross-document", provider: "openai", model: "mock", apiKey: "memory-only" };
      const controller = await DesignerRuntimeController.create({
        Agrun, gateway: window.PrintFormStudioAgent, sessionManager: { createStore: () => ({}) },
        sessionId: crypto.randomUUID(), profile,
        dataPolicy: first, getDataPolicy: () => policyState.current
      });
      const pending = controller.run("cross document check", profile);
      await started;
      const selector = document.querySelector("#document-select");
      selector.value = "purchase-order-red";
      selector.dispatchEvent(new Event("change", { bubbles: true }));
      policyState.current = second;
      release();
      return pending;
    });
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    expect(result.errorReported).toBe(true);
    expect(result.completed).toMatchObject({ terminalKind: "error", error: { code: "STALE_POLICY_CONTEXT" } });
    expect(result.result).toBeNull();
    expect(JSON.stringify(result)).not.toContain("CANARY-WRONG-DOCUMENT");
  });

});
