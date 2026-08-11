import { describe, expect, it } from "vitest";
import { createTerminalState } from "../../studio-v2/ui/agent-terminal-state.js";

describe("AI Designer terminal convergence state", () => {
  it("allows bounded replanning before failing a non-terminal final", () => {
    const state = createTerminalState({ maxFinalizeAttempts: 2 });
    expect(state.requestRepair()).toMatchObject({ ready: false, attempt: 1, exhausted: false });
    expect(state.requestRepair()).toMatchObject({ ready: false, attempt: 2, exhausted: true });
    expect(state.snapshot()).toMatchObject({ state: "running", finalizeAttempts: 2, maxFinalizeAttempts: 2 });
  });

  it("only treats a successful complete action as terminal", () => {
    const state = createTerminalState();
    expect(state.noteAction({ name: "printform_preview_changes", control: "complete", phase: "started", ok: true })).toBe(false);
    expect(state.noteAction({ name: "printform_preview_changes", control: "complete", phase: "completed", ok: false })).toBe(false);
    expect(state.isTerminalReady()).toBe(false);
    expect(state.noteAction({ name: "printform_preview_changes", control: "complete", phase: "completed", ok: true })).toBe(true);
    expect(state.snapshot()).toMatchObject({ state: "terminal_action", terminalAction: "printform_preview_changes" });
  });

  it("keeps pending approval as a terminal pause until the host resumes it", () => {
    const state = createTerminalState();
    state.notePendingApproval();
    expect(state.isTerminalReady()).toBe(true);
    expect(state.snapshot()).toMatchObject({ state: "pending_approval", pendingApproval: true });
    state.noteApplied();
    expect(state.snapshot()).toMatchObject({ state: "applied", pendingApproval: false });
  });
});
