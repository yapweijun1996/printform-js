import { describe, expect, it, vi } from "vitest";

vi.mock("../../studio-v2/core/exporter.js", () => ({
  createStandaloneHtml: vi.fn(async () => ({ html: "<html></html>", bytes: 15 }))
}));
vi.mock("../../studio-v2/ui/file-io.js", () => ({
  downloadHtml: vi.fn(),
  readHtmlFile: vi.fn(),
  saveHtmlWithPicker: vi.fn()
}));

import { createStudioActions } from "../../studio-v2/ui/studio-actions.js";
import { readHtmlFile, saveHtmlWithPicker } from "../../studio-v2/ui/file-io.js";
import { classifyRealDocument } from "../../studio-v2/core/data-policy.js";

function makeBus() {
  return {
    revision: 0,
    project: { manifest: { documentId: "save-race" }, trust: "trusted" },
    execute: vi.fn(async () => ({ ok: true, result: { ready: true, validation: { warnings: [] } } })),
    ensurePublishTransaction: vi.fn(async () => null),
    getTransaction: vi.fn(() => null),
    renderReport: null,
  };
}

describe("Studio file save state", () => {
  it("keeps a dirty project when HTML import replacement is cancelled", async () => {
    const bus = makeBus();
    const installBus = vi.fn();
    const setDirty = vi.fn();
    document.body.innerHTML = '<input id="import-file" type="file">';
    window.confirm = vi.fn(() => false);
    readHtmlFile.mockClear();
    const actions = createStudioActions({
      getBus: () => bus,
      getDirty: () => true,
      setDirty,
      setFingerprint: vi.fn(),
      getEditor: () => ({ value: "" }),
      getDataPolicy: () => classifyRealDocument(bus.project.manifest.documentId),
      installBus,
      toast: vi.fn()
    });

    await actions.importFile({ name: "replacement.html", size: 1, lastModified: 1 });

    expect(window.confirm).toHaveBeenCalledOnce();
    expect(readHtmlFile).not.toHaveBeenCalled();
    expect(installBus).not.toHaveBeenCalled();
    expect(setDirty).not.toHaveBeenCalled();
  });

  it("keeps a newer edit unsaved when the picker completes an older snapshot", async () => {
    const bus = makeBus();
    const policy = classifyRealDocument(bus.project.manifest.documentId);
    let dirty = false;
    const states = [];
    window.showSaveFilePicker = vi.fn();
    window.confirm = vi.fn(() => true);
    saveHtmlWithPicker.mockImplementation(async () => {
      bus.revision = 1;
      dirty = true;
      return true;
    });
    const actions = createStudioActions({
      getBus: () => bus,
      setDirty: (value) => { dirty = value; },
      setSaveState: (value) => states.push(value),
      getEditor: () => ({ value: "" }),
      getDataPolicy: () => policy,
      toast: vi.fn()
    });

    const result = await actions.exportDocument(true);

    expect(result).toMatchObject({ ok: true, mode: "saved", stale: true });
    expect(dirty).toBe(true);
    expect(states).toEqual(["saving", "unsaved"]);
  });
});
