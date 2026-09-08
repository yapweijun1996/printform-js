import { beforeEach, describe, expect, it, vi } from "vitest";
import { bindAgentSettingsModal } from "../../studio-v2/ui/agent-settings-modal.js";
import { settingsModalMarkup } from "../../studio-v2/ui/agent-settings-view.js";

function fixture() {
  document.body.innerHTML = `<button id="ai-settings-button"></button><button id="ai-open-settings"></button>${settingsModalMarkup()}`;
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn() }));
}

describe("agent settings modal", () => {
  beforeEach(() => fixture());

  it("closes after an asynchronous save resolves", async () => {
    let resolveSave;
    const onSave = vi.fn(() => new Promise((resolve) => { resolveSave = resolve; }));
    bindAgentSettingsModal({ get: (selector) => document.querySelector(selector), onSave });
    const modal = document.querySelector("#ai-provider-details");
    const saveButton = document.querySelector("#ai-save-profile");
    modal.hidden = false;

    saveButton.click();
    expect(saveButton.disabled).toBe(true);
    resolveSave(true);
    await Promise.resolve();
    await Promise.resolve();

    expect(onSave).toHaveBeenCalledOnce();
    expect(saveButton.disabled).toBe(false);
    expect(modal.hidden).toBe(true);
  });
});
