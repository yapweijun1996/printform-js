import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { classifyImportedDocument, classifyRealDocument, classifySampleDocument } from "../../studio-v2/core/data-policy.js";
import { clearRecoveryDraft, loadRecoveryDraft, peekRecoveryDraft, saveRecoveryDraft } from "../../studio-v2/ui/draft-cache.js";

describe("recovery draft cache", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it("round-trips a saved draft through loadRecoveryDraft", () => {
    const project = { manifest: { title: "Test" } };
    const policy = classifySampleDocument("fp-1");
    expect(saveRecoveryDraft(project, "fp-1", { policy })).toBe(true);
    expect(peekRecoveryDraft()).toEqual({ version: 1, savedAt: expect.any(Number), fingerprint: "fp-1", classification: "synthetic" });
    expect(peekRecoveryDraft()).not.toHaveProperty("project");
    const loaded = loadRecoveryDraft({ policy, explicit: true });
    expect(loaded.fingerprint).toBe("fp-1");
    expect(loaded.project).toEqual(project);
  });

  it("requires host classification and does not auto-load a restrictive record", () => {
    expect(saveRecoveryDraft({ secret: "CANARY" }, "fp-no-policy")).toBe(false);
    localStorage.setItem("printform-studio-v2-recovery", JSON.stringify({ version: 1, savedAt: Date.now(), fingerprint: "fp-old", classification: "real", project: { secret: "CANARY" } }));
    expect(loadRecoveryDraft()).toBeNull();
    expect(loadRecoveryDraft({ policy: classifyRealDocument("fp-old") })).toBeNull();
    expect(loadRecoveryDraft({ policy: classifyRealDocument("fp-old"), explicit: true }).project).toEqual({ secret: "CANARY" });
  });

  it("does not treat stored classification metadata as synthetic provenance", () => {
    localStorage.setItem("printform-studio-v2-recovery", JSON.stringify({
      version: 1, savedAt: Date.now(), fingerprint: "forged-synthetic",
      classification: "synthetic", project: { manifest: { documentId: "recovered-document" }, secret: "CANARY" }
    }));
    const metadata = peekRecoveryDraft();
    expect(metadata.classification).toBe("synthetic");
    const restrictive = classifyImportedDocument("recovered-document");
    expect(loadRecoveryDraft({ policy: restrictive, explicit: true }).project.secret).toBe("CANARY");
    expect(restrictive.allowDurable).toBe(false);
    expect(restrictive.allowPersistentSessions).toBe(false);
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

  it("does not persist recovery drafts for unknown or real-data policies", () => {
    const spy = vi.spyOn(localStorage, "setItem");

    expect(saveRecoveryDraft({ a: 1 }, "unknown", { policy: classifyImportedDocument("doc-unknown") })).toBe(false);
    expect(saveRecoveryDraft({ a: 1 }, "real", { policy: classifyRealDocument("doc-real") })).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it("does not silently delete a draft older than 7 days", () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    localStorage.setItem("printform-studio-v2-recovery", JSON.stringify({ version: 1, savedAt: eightDaysAgo, fingerprint: "old", project: {} }));
    expect(loadRecoveryDraft({ policy: classifySampleDocument("old"), explicit: true })).toBeNull();
    expect(localStorage.getItem("printform-studio-v2-recovery")).not.toBeNull();
  });

  it("discards and returns null for corrupted JSON instead of throwing", () => {
    localStorage.setItem("printform-studio-v2-recovery", "{not json");
    expect(loadRecoveryDraft({ policy: classifySampleDocument("corrupt"), explicit: true })).toBeNull();
  });

  it("clearRecoveryDraft removes the stored draft", () => {
    const policy = classifySampleDocument("fp-3");
    saveRecoveryDraft({ a: 1 }, "fp-3", { policy });
    clearRecoveryDraft();
    expect(loadRecoveryDraft({ policy, explicit: true })).toBeNull();
  });
});
