import { describe, expect, it, vi } from "vitest";
import { createServiceWorkerUpgradeController, setupServiceWorkerUpgrade } from "../../studio-v2/ui/service-worker-upgrade.js";

class FakeTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, listener) { const list = this.listeners.get(type) || []; list.push(listener); this.listeners.set(type, list); }
  removeEventListener(type, listener) { this.listeners.set(type, (this.listeners.get(type) || []).filter((item) => item !== listener)); }
  dispatch(type) { for (const listener of this.listeners.get(type) || []) listener({ type, target: this }); }
}

class FakeWorker extends FakeTarget {
  constructor(state = "installing") { super(); this.state = state; this.messages = []; }
  postMessage(message) { this.messages.push(message); }
}

class FakeRegistration extends FakeTarget {
  constructor({ waiting = null, installing = null, update } = {}) {
    super(); this.waiting = waiting; this.installing = installing; this.update = update || vi.fn(async () => {});
  }
}

class FakeElement extends FakeTarget {
  constructor() {
    super();
    this.disabled = false;
    this.textContent = "";
    this.dataset = {};
    this.attributes = {};
    this.classList = {
      values: new Set(["hidden"]),
      add: (name) => this.classList.values.add(name),
      remove: (name) => this.classList.values.delete(name),
      contains: (name) => this.classList.values.has(name),
      toggle: (name, force) => {
        const shouldHave = force === undefined ? !this.classList.values.has(name) : force;
        if (shouldHave) this.classList.values.add(name); else this.classList.values.delete(name);
        return shouldHave;
      }
    };
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
}

function dependencies(overrides = {}) {
  const worker = overrides.worker || new FakeWorker("installed");
  const registration = overrides.registration || new FakeRegistration({ waiting: worker });
  const serviceWorker = overrides.serviceWorker || new FakeTarget();
  serviceWorker.controller = {};
  return {
    worker,
    registration,
    serviceWorker,
    banner: new FakeElement(),
    status: new FakeElement(),
    button: new FakeElement(),
    saveButton: overrides.saveButton || new FakeElement()
  };
}

describe("service worker upgrade handoff", () => {
  it("posts SKIP_WAITING to the waiting worker", async () => {
    const deps = dependencies();
    const controller = createServiceWorkerUpgradeController(deps);

    controller.showIfWaiting();
    const result = await controller.requestUpgrade();

    expect(result).toEqual({ ok: true });
    expect(deps.worker.messages).toEqual([{ type: "SKIP_WAITING" }]);
    expect(deps.button.disabled).toBe(true);
  });

  it("saves the draft before posting SKIP_WAITING and marks the result as saved", async () => {
    const deps = dependencies();
    let resolveSave;
    const onSaveDraft = vi.fn(() => new Promise((resolve) => { resolveSave = resolve; }));
    const controller = createServiceWorkerUpgradeController({ ...deps, isDirty: () => false, onSaveDraft });

    const upgradePromise = controller.saveAndUpgrade();
    await Promise.resolve();

    expect(onSaveDraft).toHaveBeenCalledOnce();
    expect(deps.worker.messages).toHaveLength(0);
    expect(deps.saveButton.disabled).toBe(true);

    resolveSave({ ok: true });
    await expect(upgradePromise).resolves.toEqual({ ok: true, saved: true });
    expect(deps.worker.messages).toEqual([{ type: "SKIP_WAITING" }]);
  });

  it.each([
    { label: "cancelled", expectedReason: "cancelled", expectedState: "save_cancelled", firstSave: () => ({ ok: false, reason: "cancelled" }) },
    { label: "failed", expectedReason: "save_failed", expectedState: "save_failed", firstSave: () => { throw new Error("save failed"); } }
  ])("does not upgrade after a $label save and allows retry", async ({ expectedReason, expectedState, firstSave }) => {
    const deps = dependencies();
    let dirty = true;
    const onSaveDraft = vi.fn()
      .mockImplementationOnce(async () => firstSave())
      .mockImplementationOnce(async () => {
        dirty = false;
        return { ok: true };
      });
    const onState = vi.fn();
    const controller = createServiceWorkerUpgradeController({ ...deps, isDirty: () => dirty, onSaveDraft, onState });

    const failed = await controller.saveAndUpgrade();

    expect(failed).toMatchObject({ ok: false, reason: expectedReason });
    expect(onState).toHaveBeenLastCalledWith({ reason: expectedState });
    expect(deps.worker.messages).toHaveLength(0);
    expect(dirty).toBe(true);
    expect(deps.button.disabled).toBe(false);
    expect(deps.saveButton.disabled).toBe(false);
    expect(deps.saveButton.attributes["aria-busy"]).toBeUndefined();

    const retry = await controller.saveAndUpgrade();

    expect(retry).toEqual({ ok: true, saved: true });
    expect(onSaveDraft).toHaveBeenCalledTimes(2);
    expect(deps.worker.messages).toEqual([{ type: "SKIP_WAITING" }]);
  });

  it("does not switch while the draft is dirty", async () => {
    const deps = dependencies();
    const toast = vi.fn();
    const onState = vi.fn();
    const controller = createServiceWorkerUpgradeController({ ...deps, isDirty: () => true, toast, onState, translateMessage: (key) => key });

    const result = await controller.requestUpgrade();

    expect(result.reason).toBe("dirty");
    expect(deps.worker.messages).toHaveLength(0);
    expect(toast).toHaveBeenCalledWith("toast.saveBeforeUpdate");
    expect(onState).toHaveBeenCalledWith({ reason: "dirty" });
    expect(deps.button.disabled).toBe(false);
  });

  it("keeps the dirty reason visible in the update banner", async () => {
    const deps = dependencies();
    const documentObject = {
      querySelector: (selector) => ({
        "#update-banner": deps.banner,
        "#update-button": deps.button,
        "#save-upgrade-button": deps.saveButton,
        "#update-status": deps.status
      }[selector] || null)
    };
    const windowObject = new FakeTarget();
    deps.serviceWorker.register = vi.fn(async () => deps.registration);
    await setupServiceWorkerUpgrade({
      navigatorObject: { serviceWorker: deps.serviceWorker },
      documentObject,
      windowObject,
      isDirty: () => true,
      toast: vi.fn(),
      translateMessage: (key) => key === "banner.updateDirty" ? "Save this draft before upgrading." : key
    });

    deps.button.dispatch("click");

    expect(deps.banner.dataset.upgradeState).toBe("dirty");
    expect(deps.status.textContent).toBe("Save this draft before upgrading.");
    expect(deps.status.classList.contains("hidden")).toBe(false);
    expect(deps.button.attributes["aria-describedby"]).toBe("update-status");
    expect(deps.registration.update).not.toHaveBeenCalled();
  });

  it("binds the save-upgrade button and keeps save status accessible", async () => {
    const deps = dependencies();
    let resolveSave;
    const onSaveDraft = vi.fn(() => new Promise((resolve) => { resolveSave = resolve; }));
    const documentObject = {
      querySelector: (selector) => ({
        "#update-banner": deps.banner,
        "#update-button": deps.button,
        "#save-upgrade-button": deps.saveButton,
        "#update-status": deps.status
      }[selector] || null)
    };
    deps.serviceWorker.register = vi.fn(async () => deps.registration);
    await setupServiceWorkerUpgrade({
      navigatorObject: { serviceWorker: deps.serviceWorker },
      documentObject,
      onSaveDraft,
      translateMessage: (key) => ({
        "banner.saveAndUpgradeBusy": "Saving draft…",
        "banner.saveAndUpgradeCancelled": "Upgrade cancelled."
      }[key] || key)
    });

    deps.saveButton.dispatch("click");
    await Promise.resolve();

    expect(onSaveDraft).toHaveBeenCalledOnce();
    expect(deps.banner.dataset.upgradeState).toBe("saving");
    expect(deps.status.textContent).toBe("Saving draft…");
    expect(deps.status.classList.contains("hidden")).toBe(false);
    expect(deps.button.attributes["aria-describedby"]).toBe("update-status");
    expect(deps.saveButton.attributes["aria-describedby"]).toBe("update-status");
    expect(deps.saveButton.disabled).toBe(true);

    resolveSave({ ok: false, reason: "cancelled" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(deps.banner.dataset.upgradeState).toBe("save_cancelled");
    expect(deps.status.textContent).toBe("Upgrade cancelled.");
    expect(deps.status.classList.contains("hidden")).toBe(false);
    expect(deps.button.attributes["aria-describedby"]).toBe("update-status");
    expect(deps.saveButton.attributes["aria-describedby"]).toBe("update-status");
    expect(deps.saveButton.disabled).toBe(false);
    expect(deps.saveButton.attributes["aria-busy"]).toBeUndefined();
    expect(deps.worker.messages).toHaveLength(0);
  });

  it("refreshes the registration when waiting is missing instead of silently doing nothing", async () => {
    const deps = dependencies({ worker: null, registration: new FakeRegistration() });
    const worker = new FakeWorker();
    deps.registration.update = vi.fn(async () => {
      deps.registration.installing = worker;
      deps.registration.dispatch("updatefound");
      deps.registration.waiting = worker;
      worker.state = "installed";
      worker.dispatch("statechange");
    });
    const controller = createServiceWorkerUpgradeController(deps);

    const result = await controller.requestUpgrade();

    expect(result).toEqual({ ok: true });
    expect(deps.registration.update).toHaveBeenCalledOnce();
    expect(worker.messages).toEqual([{ type: "SKIP_WAITING" }]);
  });

  it("reports an unavailable upgrade when the refresh still produces no worker", async () => {
    const deps = dependencies({ worker: null, registration: new FakeRegistration() });
    const toast = vi.fn();
    const controller = createServiceWorkerUpgradeController({ ...deps, toast, translateMessage: (key) => key, waitingTimeoutMs: 10 });

    const result = await controller.requestUpgrade();

    expect(result.reason).toBe("unavailable");
    expect(toast).toHaveBeenCalledWith("toast.updateUnavailable");
    expect(deps.button.disabled).toBe(false);
    expect(deps.button.attributes["aria-busy"]).toBeUndefined();
  });

  it("reloads once when the new worker takes control", async () => {
    const deps = dependencies();
    const documentObject = {
      querySelector: (selector) => ({
        "#update-banner": deps.banner,
        "#update-button": deps.button,
        "#save-upgrade-button": deps.saveButton,
        "#update-status": deps.status
      }[selector] || null)
    };
    deps.serviceWorker.register = vi.fn(async () => deps.registration);
    const navigatorObject = { serviceWorker: deps.serviceWorker };
    const reload = vi.fn();
    await setupServiceWorkerUpgrade({ navigatorObject, documentObject, reload });

    deps.serviceWorker.dispatch("controllerchange");
    deps.serviceWorker.dispatch("controllerchange");

    expect(reload).toHaveBeenCalledOnce();
  });
});
