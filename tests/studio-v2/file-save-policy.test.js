import { afterEach, describe, expect, it, vi } from "vitest";
import { saveHtmlWithPicker } from "../../studio-v2/ui/file-io.js";
import { inlineProjectAssets } from "../../studio-v2/core/assets.js";
import { assertPolicyCurrent, classifyRealDocument, classifySyntheticDocument } from "../../studio-v2/core/data-policy.js";

function fixture() {
  const policy = classifySyntheticDocument("SYNTHETIC-FILE");
  let current = policy;
  const writable = { write: vi.fn(async () => {}), close: vi.fn(async () => {}), abort: vi.fn(async () => {}) };
  const handle = { createWritable: vi.fn(async () => writable) };
  window.showSaveFilePicker = vi.fn(async () => handle);
  return { writable, handle, policy, assertCurrent: () => assertPolicyCurrent(policy, current), expire() { current = classifyRealDocument(policy.documentId); } };
}

describe("explicit file side-effect admission", () => {
  afterEach(() => { delete window.showSaveFilePicker; vi.unstubAllGlobals(); });

  it("does not open a writable stream after the picker context changes", async () => {
    const f = fixture();
    window.showSaveFilePicker.mockImplementation(async () => { f.expire(); return f.handle; });
    await expect(saveHtmlWithPicker("SYNTHETIC-FILE-CANARY", "fixture.html", "Fixture", f)).rejects.toMatchObject({ code: "STALE_POLICY_CONTEXT" });
    expect(f.handle.createWritable).not.toHaveBeenCalled();
  });

  it("aborts an uncommitted stream if policy changes while the stream opens", async () => {
    const f = fixture();
    f.handle.createWritable.mockImplementation(async () => { f.expire(); return f.writable; });
    await expect(saveHtmlWithPicker("SYNTHETIC-FILE-CANARY", "fixture.html", "Fixture", f)).rejects.toMatchObject({ code: "STALE_POLICY_CONTEXT" });
    expect(f.writable.write).not.toHaveBeenCalled();
    expect(f.writable.abort).toHaveBeenCalledOnce();
  });

  it("does not close or retry a buffered write after policy changes", async () => {
    const f = fixture();
    f.writable.write.mockImplementation(async () => f.expire());
    await expect(saveHtmlWithPicker("SYNTHETIC-FILE-CANARY", "fixture.html", "Fixture", f)).rejects.toMatchObject({ code: "STALE_POLICY_CONTEXT" });
    expect(f.writable.write).toHaveBeenCalledOnce();
    expect(f.writable.close).not.toHaveBeenCalled();
    expect(f.writable.abort).toHaveBeenCalledOnce();
  });

  it("preserves a confirmed close even if its context changed while completing", async () => {
    const f = fixture();
    f.writable.close.mockImplementation(async () => f.expire());
    await expect(saveHtmlWithPicker("SYNTHETIC-FILE-CANARY", "fixture.html", "Fixture", f)).resolves.toBe(true);
    expect(f.writable.close).toHaveBeenCalledOnce();
    expect(f.writable.abort).not.toHaveBeenCalled();
  });

  it.each(["write", "close"])("preserves the original %s failure without alternate storage", async (step) => {
    const f = fixture();
    const failure = new DOMException("Synthetic write failure", "NotAllowedError");
    f.writable[step].mockRejectedValue(failure);
    await expect(saveHtmlWithPicker("SYNTHETIC-FILE-CANARY", "fixture.html", "Fixture", f)).rejects.toBe(failure);
    expect(f.writable[step]).toHaveBeenCalledOnce();
    expect(f.writable.abort).toHaveBeenCalledOnce();
  });

  it("stops an asset sequence after a policy change without requesting the next URL", async () => {
    const f = fixture();
    const fetch = vi.fn(async () => { f.expire(); return { ok: true, blob: vi.fn() }; });
    vi.stubGlobal("fetch", fetch);
    const project = { manifest: { assets: { allowExternalHttps: true } }, themeCss: "", templateHtml: '<img src="https://assets.test/first"><img src="https://assets.test/second">' };
    await expect(inlineProjectAssets(project, "https://assets.test/", { dataPolicy: f.policy, assertCurrent: f.assertCurrent })).rejects.toMatchObject({ code: "STALE_POLICY_CONTEXT" });
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][0]).toBe("https://assets.test/first");
  });
});
