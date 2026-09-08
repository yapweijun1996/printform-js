import { describe, expect, it, vi } from "vitest";
import { CommandBus } from "../../studio-v2/core/command-bus.js";
import { classifyRealDocument, classifySyntheticDocument, nextDataPolicy } from "../../studio-v2/core/data-policy.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";
import { createAgentPanelPolicyControls } from "../../studio-v2/ui/agent-panel-policy.js";

describe("Current-document policy ownership", () => {
  it("uses a new durable namespace without hydrating or overwriting an older document snapshot", () => {
    const values = new Map();
    const storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
    const previous = createSalesInvoiceProject();
    previous.manifest.title = "SYNTHETIC-OLD-CONTEXT";
    const original = new CommandBus(previous, { transactionStorage: storage, dataPolicy: classifySyntheticDocument(previous.manifest.documentId) });
    const retained = new Map(values);
    const current = createSalesInvoiceProject();
    current.manifest.title = "SYNTHETIC-NEW-DECLARATION";
    const policy = nextDataPolicy(classifyRealDocument(current.manifest.documentId), "synthetic");
    const bus = new CommandBus(current, { transactionStorage: storage, transactionNamespace: policy.contextId, dataPolicy: policy });
    expect(bus.project.manifest.title).toBe(current.manifest.title);
    expect(bus.transactionStore.key).not.toBe(original.transactionStore.key);
    expect(bus.transactionStore.formId).toBe(original.transactionStore.formId);
    expect(bus.revision).toBe(0);
    for (const [key, value] of retained) expect(values.get(key)).toBe(value);
  });

  it("delegates a panel classification request to the host before changing local policy", async () => {
    const state = { dataPolicy: classifyRealDocument("SYNTHETIC-PANEL"), realData: true };
    const host = vi.fn();
    const sessions = { setDataPolicy: vi.fn() };
    const controls = createAgentPanelPolicyControls({ state, sessions, onRealDataChange: host });
    await controls.setRealData(false);
    expect(host).toHaveBeenCalledWith(false);
    expect(state.dataPolicy.classification).toBe("real");
    expect(sessions.setDataPolicy).not.toHaveBeenCalled();
  });

  it("resets the Agent scope when a new project replaces the current document", async () => {
    const state = { dataPolicy: classifySyntheticDocument("SYNTHETIC-PANEL"), realData: false, records: [], sessionPersistenceAnnounced: false };
    const sessions = { setDataPolicy: vi.fn(), list: vi.fn(async () => []) };
    const runtime = { invalidateSession: vi.fn(), refreshSessions: vi.fn(async () => {}) };
    const docContext = { update: vi.fn() };
    const onScopeChange = vi.fn();
    const controls = createAgentPanelPolicyControls({ state, sessions, runtime, renderSessions: vi.fn(), docContext, addMessage: vi.fn(), onScopeChange });

    controls.onProjectChanged(createSalesInvoiceProject(), state.dataPolicy, "import");

    expect(onScopeChange).toHaveBeenCalledWith({ kind: "document" });
    expect(docContext.update).toHaveBeenCalledWith(expect.objectContaining({ scope: "all", selection: "Entire document" }));
  });
});
