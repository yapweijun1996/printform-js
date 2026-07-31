import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { clearRecoveryDraft, loadRecoveryDraft, saveRecoveryDraft } from "../../studio-v2/ui/draft-cache.js";

describe("recovery draft cache", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it("round-trips a saved draft through loadRecoveryDraft", () => {
    const project = { manifest: { title: "Test" } };
    expect(saveRecoveryDraft(project, "fp-1")).toBe(true);
    const loaded = loadRecoveryDraft();
    expect(loaded.fingerprint).toBe("fp-1");
    expect(loaded.project).toEqual(project);
  });

  it("does not throw and returns false when localStorage.setItem throws (quota exceeded / private mode)", () => {
    const spy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    // Regression: this write happens inside the command bus's synchronous
    // "change" event listener — an uncaught throw here would break every
    // subsequent edit, not just recovery.
    expect(() => saveRecoveryDraft({ big: "payload" }, "fp-2")).not.toThrow();
    expect(saveRecoveryDraft({ big: "payload" }, "fp-2")).toBe(false);
    spy.mockRestore();
  });

  it("discards and returns null for a draft older than 7 days", () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    localStorage.setItem("printform-studio-v2-recovery", JSON.stringify({ version: 1, savedAt: eightDaysAgo, fingerprint: "old", project: {} }));
    expect(loadRecoveryDraft()).toBeNull();
    expect(localStorage.getItem("printform-studio-v2-recovery")).toBeNull();
  });

  it("discards and returns null for corrupted JSON instead of throwing", () => {
    localStorage.setItem("printform-studio-v2-recovery", "{not json");
    expect(loadRecoveryDraft()).toBeNull();
  });

  it("clearRecoveryDraft removes the stored draft", () => {
    saveRecoveryDraft({ a: 1 }, "fp-3");
    clearRecoveryDraft();
    expect(loadRecoveryDraft()).toBeNull();
  });
});
