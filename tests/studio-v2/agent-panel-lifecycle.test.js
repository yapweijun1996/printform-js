import { afterEach, describe, expect, it, vi } from "vitest";
import { createPanelSessions } from "../../studio-v2/ui/agent-panel-sessions.js";
import { DesignerRuntimeController } from "../../studio-v2/ui/agent-runtime.js";
import { classifySyntheticDocument, classifyRealDocument } from "../../studio-v2/core/data-policy.js";

const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };

function harness() {
  const state = { dataPolicy: classifySyntheticDocument("SYNTHETIC-A"), currentRecord: { id: "SYNTHETIC-CHAT-A" }, records: [], log: { replaceChildren: vi.fn() } };
  const sessions = { list: vi.fn(async () => []), create: vi.fn(async () => ({ id: "SYNTHETIC-CHAT-B" })) };
  const renderProposal = vi.fn();
  const addMessage = vi.fn();
  const owner = createPanelSessions({ state, sessions, get: () => null, getGateway: () => ({}),
    profile: () => ({ id: "SYNTHETIC-PROFILE" }), status: vi.fn(), addMessage,
    renderProposal, renderSessions: vi.fn(), onCandidateState: vi.fn(), handleRuntimeEvent: vi.fn() });
  return { state, sessions, owner, renderProposal, addMessage };
}

describe("panel session lifecycle admission", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rejects late session creation after a document change before installing its record", async () => {
    const f = harness();
    const delay = deferred();
    f.sessions.create.mockReturnValue(delay.promise);
    const result = expect(f.owner.newSession()).rejects.toMatchObject({ code: "STALE_POLICY_CONTEXT" });
    f.state.dataPolicy = classifyRealDocument("SYNTHETIC-B");
    f.owner.invalidateSession();
    delay.resolve({ id: "SYNTHETIC-OLD-RECORD" });
    await result;
    expect(f.state.currentRecord).toBeNull();
    expect(f.addMessage).not.toHaveBeenCalled();
  });

  it("does not replay delayed session lists into another session or document", async () => {
    const f = harness();
    const delay = deferred();
    f.sessions.list.mockReturnValue(delay.promise);
    const result = expect(f.owner.refreshSessions()).rejects.toMatchObject({ code: "STALE_POLICY_CONTEXT" });
    f.owner.invalidateSession();
    delay.resolve([{ id: "SYNTHETIC-STALE-RECORD" }]);
    await result;
    expect(f.state.records).toEqual([]);
  });

  it("discards an initialized old controller and suppresses its callbacks after stop", async () => {
    const f = harness();
    const delay = deferred();
    const controller = { session: () => delay.promise, stop: vi.fn() };
    let options;
    vi.spyOn(DesignerRuntimeController, "create").mockImplementation(async (input) => { options = input; return controller; });
    const result = expect(f.owner.controllerFor(f.state.currentRecord)).rejects.toMatchObject({ code: "STALE_POLICY_CONTEXT" });
    await Promise.resolve();
    f.owner.stopTurn();
    f.renderProposal.mockClear();
    options.onProposal({ canary: "SYNTHETIC-STALE-PROPOSAL" });
    options.onEvent({ type: "SYNTHETIC-STALE-EVENT" });
    delay.resolve({});
    await result;
    expect(controller.stop).toHaveBeenCalledOnce();
    expect(f.renderProposal).not.toHaveBeenCalled();
    expect(f.state.controller).toBeNull();
  });

  it("shares concurrent initialization of the same current session", async () => {
    const f = harness();
    const controller = { session: async () => ({}), stop: vi.fn() };
    const create = vi.spyOn(DesignerRuntimeController, "create").mockResolvedValue(controller);
    const results = await Promise.all([f.owner.controllerFor(f.state.currentRecord), f.owner.controllerFor(f.state.currentRecord)]);
    expect(results).toEqual([controller, controller]);
    expect(create).toHaveBeenCalledOnce();
  });

  it("blocks runtime construction after the awaited skill step changes policy", async () => {
    const policy = classifySyntheticDocument("SYNTHETIC-A");
    let current = policy;
    const createRuntime = vi.fn();
    const result = expect(DesignerRuntimeController.create({ Agrun: { createRuntime }, dataPolicy: policy, getDataPolicy: () => current })).rejects.toMatchObject({ code: "STALE_POLICY_CONTEXT" });
    current = classifyRealDocument("SYNTHETIC-A");
    await result;
    expect(createRuntime).not.toHaveBeenCalled();
  });
});
