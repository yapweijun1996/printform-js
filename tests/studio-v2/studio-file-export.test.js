import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../studio-v2/core/exporter.js", () => ({ createStandaloneHtml: vi.fn() }));
vi.mock("../../studio-v2/ui/file-io.js", () => ({ downloadHtml: vi.fn(), saveHtmlWithPicker: vi.fn() }));
import { createStandaloneHtml } from "../../studio-v2/core/exporter.js";
import { downloadHtml, saveHtmlWithPicker } from "../../studio-v2/ui/file-io.js";
import { createFileExport, createPrintPreview } from "../../studio-v2/ui/studio-file-export.js";
import { classifyRealDocument, nextDataPolicy } from "../../studio-v2/core/data-policy.js";

function fixture() {
  const bus = { revision: 0, project: { manifest: { documentId: "SYNTHETIC-FILE" } },
    execute: vi.fn(async () => ({ ok: true, result: { ready: true, validation: { warnings: [] } } })),
    ensurePublishTransaction: vi.fn(async () => null), transactionStore: { head: {} }, recordEvidencePack: vi.fn() };
  let current = bus;
  let policy = classifyRealDocument(bus.project.manifest.documentId);
  const setDirty = vi.fn();
  const setSaveState = vi.fn();
  const toast = vi.fn();
  const exportFile = createFileExport({ getBus: () => current, getDataPolicy: () => policy, setDirty, setSaveState, toast });
  return { bus, exportFile, setDirty, setSaveState, toast,
    replace() { current = { ...bus, project: { manifest: { documentId: "SYNTHETIC-OTHER" } } }; },
    expire() { policy = nextDataPolicy(policy, "unknown"); }, clearPolicy() { policy = null; } };
}

describe("file export policy and confirmed outcomes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.confirm = vi.fn(() => true);
    window.showSaveFilePicker = vi.fn();
    window.open = vi.fn(() => ({ close: vi.fn() }));
    createStandaloneHtml.mockResolvedValue({ html: "SYNTHETIC-FILE-CANARY", bytes: 20, evidencePack: {} });
    saveHtmlWithPicker.mockResolvedValue(true);
  });
  afterEach(() => { delete window.showSaveFilePicker; vi.restoreAllMocks(); });

  it.each(["replace", "expire", "clearPolicy"])("blocks the final sink after context change: %s", async (change) => {
    const f = fixture();
    createStandaloneHtml.mockImplementation(async () => { f[change](); return { html: "SYNTHETIC-STALE", evidencePack: {} }; });
    expect(await f.exportFile(true)).toMatchObject({ ok: false, reason: "stale" });
    expect(saveHtmlWithPicker).not.toHaveBeenCalled();
    expect(downloadHtml).not.toHaveBeenCalled();
    expect(f.bus.recordEvidencePack).not.toHaveBeenCalled();
    expect(f.setDirty).not.toHaveBeenCalled();
  });

  it("does not export a replacement document after old readiness completes", async () => {
    const f = fixture();
    f.bus.execute.mockImplementation(async () => { f.replace(); return { ok: true, result: { ready: true } }; });
    expect(await f.exportFile(true)).toMatchObject({ ok: false, reason: "stale" });
    expect(createStandaloneHtml).not.toHaveBeenCalled();
    expect(f.setSaveState).not.toHaveBeenCalled();
  });

  it("keeps the confirmed file receipt without overwriting another document's save status", async () => {
    const f = fixture();
    saveHtmlWithPicker.mockImplementation(async () => { f.replace(); return true; });
    expect(await f.exportFile(true)).toMatchObject({ ok: true, mode: "saved", stale: true });
    expect(f.setSaveState.mock.calls).toEqual([["saving"]]);
    expect(f.setDirty).not.toHaveBeenCalled();
  });

  it("retains a confirmed save even if feedback processing fails", async () => {
    const f = fixture();
    f.toast.mockImplementation(() => { throw new Error("SYNTHETIC-FEEDBACK-FAILURE"); });
    expect(await f.exportFile(true)).toMatchObject({ ok: true, mode: "saved", feedbackFailed: true });
    expect(saveHtmlWithPicker).toHaveBeenCalledOnce();
    expect(downloadHtml).not.toHaveBeenCalled();
    expect(f.setSaveState).toHaveBeenLastCalledWith("saved");
  });

  it.each([["AbortError", undefined, "cancelled"], ["Error", "FILE_WRITE_UNCONFIRMED", "unconfirmed"]])("does not retry or download after %s/%s", async (name, code, reason) => {
    const f = fixture();
    saveHtmlWithPicker.mockRejectedValue(Object.assign(new Error("SYNTHETIC-SAVE-FAILURE"), { name, code }));
    expect(await f.exportFile(true)).toMatchObject({ ok: false, reason });
    expect(downloadHtml).not.toHaveBeenCalled();
    expect(f.setSaveState).toHaveBeenLastCalledWith(reason);
    expect(f.setDirty).not.toHaveBeenCalled();
  });

  it("distinguishes a requested download from a confirmed file save", async () => {
    const f = fixture();
    expect(await f.exportFile(false, { confirmExport: false })).toMatchObject({ ok: true, mode: "download-started", saved: false });
    expect(f.setSaveState).toHaveBeenLastCalledWith("download-started");
    expect(f.setDirty).not.toHaveBeenCalled();
  });

  it("does not install an old print-preview artifact after policy changes", async () => {
    const bus = { revision: 0, project: { trust: "trusted", manifest: { documentId: "SYNTHETIC-PRINT" } } };
    let policy = classifyRealDocument(bus.project.manifest.documentId);
    const popup = { close: vi.fn(), location: "", opener: {} };
    window.open.mockReturnValue(popup);
    createStandaloneHtml.mockImplementation(async () => { policy = nextDataPolicy(policy, "unknown"); return { html: "SYNTHETIC-PRINT-CANARY" }; });
    const preview = createPrintPreview({ getBus: () => bus, getDataPolicy: () => policy, toast: vi.fn() });
    await preview();
    expect(popup.opener).toBeNull();
    expect(popup.location).toBe("");
    expect(popup.close).toHaveBeenCalledOnce();
  });
});
