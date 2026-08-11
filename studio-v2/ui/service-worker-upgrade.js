const SKIP_WAITING_MESSAGE = Object.freeze({ type: "SKIP_WAITING" });
const WAITING_TIMEOUT_MS = 10_000;
const FALLBACK_MESSAGES = Object.freeze({
  "banner.updateDirty": "Upgrade paused: this draft has unsaved changes. Export or save it first, then click Safe upgrade again.",
  "banner.saveAndUpgradeBusy": "Saving the draft before upgrading…",
  "banner.saveAndUpgradeFailed": "Draft was not saved, so the upgrade was not started.",
  "banner.saveAndUpgradeCancelled": "Upgrade not started. The draft is still unsaved.",
  "banner.draftSaved": "Draft saved locally; starting safe upgrade…",
  "toast.saveBeforeUpdate": "Export or save the current draft first",
  "toast.saveAndUpgradeUnavailable": "Draft was not saved, so the upgrade was not started",
  "toast.updateUnavailable": "The PWA upgrade is no longer available; reload and try again"
});

function fallbackMessage(key) {
  return FALLBACK_MESSAGES[key] || "The PWA upgrade could not be started";
}

function translate(translateMessage, key) {
  return typeof translateMessage === "function"
    ? translateMessage(key, {}, fallbackMessage(key))
    : fallbackMessage(key);
}

function waitForWaitingWorker(registration, timeoutMs = WAITING_TIMEOUT_MS) {
  if (registration?.waiting) return { promise: Promise.resolve(registration.waiting), cancel() {} };
  let finish;
  const promise = new Promise((resolve) => { finish = resolve; });
  let timer = setTimeout(() => finish(null), timeoutMs);
  const cleanup = [];
  const done = (worker = registration?.waiting) => {
    clearTimeout(timer);
    cleanup.splice(0).forEach((remove) => remove());
    finish(worker || null);
  };
  const observeInstalling = (worker) => {
    if (!worker?.addEventListener) return;
    const onStateChange = () => {
      if (worker.state === "installed" || worker.state === "redundant") done();
    };
    worker.addEventListener("statechange", onStateChange);
    cleanup.push(() => worker.removeEventListener?.("statechange", onStateChange));
  };
  const onUpdateFound = () => observeInstalling(registration.installing);
  registration?.addEventListener?.("updatefound", onUpdateFound);
  cleanup.push(() => registration?.removeEventListener?.("updatefound", onUpdateFound));
  observeInstalling(registration?.installing);
  return { promise, cancel: () => done(null) };
}

export function createServiceWorkerUpgradeController({
  registration,
  serviceWorker,
  banner,
  button,
  saveButton,
  isDirty = () => false,
  toast = () => {},
  translateMessage,
  onSaveDraft = async () => ({ ok: false, reason: "unavailable" }),
  onWarning = () => {},
  onState = () => {},
  waitingTimeoutMs = WAITING_TIMEOUT_MS
}) {
  let upgrading = false;
  let saving = false;

  function showBanner() {
    banner?.classList.remove("hidden");
  }

  function showIfWaiting() {
    if (registration?.waiting && serviceWorker?.controller) showBanner();
  }

  function handleUpdateFound() {
    const worker = registration?.installing;
    if (!worker?.addEventListener) return;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && serviceWorker?.controller) showBanner();
    });
  }

  function setBusy(value) {
    [button, saveButton].filter(Boolean).forEach((control) => {
      control.disabled = value;
      if (value) control.setAttribute?.("aria-busy", "true");
      else control.removeAttribute?.("aria-busy");
    });
  }

  async function requestUpgrade() {
    if (isDirty()) {
      onState({ reason: "dirty" });
      toast(translate(translateMessage, "toast.saveBeforeUpdate"));
      return { ok: false, reason: "dirty" };
    }
    if (upgrading || saving) return { ok: false, reason: "in_progress" };

    onState({ reason: "upgrading" });
    setBusy(true);
    let waiting = registration?.waiting;
    let watcher;
    if (!waiting) {
      watcher = waitForWaitingWorker(registration, waitingTimeoutMs);
      try {
        await registration?.update?.();
      } catch (error) {
        watcher.cancel();
        setBusy(false);
        onWarning(error);
        onState({ reason: "unavailable" });
        toast(translate(translateMessage, "toast.updateUnavailable"));
        return { ok: false, reason: "update_failed" };
      }
      waiting = await watcher.promise;
    }
    if (!waiting) {
      setBusy(false);
      onState({ reason: "unavailable" });
      toast(translate(translateMessage, "toast.updateUnavailable"));
      return { ok: false, reason: "unavailable" };
    }

    upgrading = true;
    try {
      waiting.postMessage(SKIP_WAITING_MESSAGE);
      return { ok: true };
    } catch (error) {
      upgrading = false;
      setBusy(false);
      onWarning(error);
      onState({ reason: "unavailable" });
      toast(translate(translateMessage, "toast.updateUnavailable"));
      return { ok: false, reason: "message_failed" };
    }
  }

  async function saveAndUpgrade() {
    if (upgrading || saving) return { ok: false, reason: "in_progress" };
    saving = true;
    setBusy(true);
    onState({ reason: "saving" });
    let saved;
    try {
      saved = await onSaveDraft();
    } catch (error) {
      saving = false;
      setBusy(false);
      onWarning(error);
      onState({ reason: "save_failed" });
      toast(translate(translateMessage, "toast.saveAndUpgradeUnavailable"));
      return { ok: false, reason: "save_failed" };
    }
    saving = false;
    if (!saved?.ok) {
      setBusy(false);
      const reason = saved?.reason === "cancelled" ? "save_cancelled" : "save_failed";
      onState({ reason });
      if (reason === "save_failed") toast(translate(translateMessage, "toast.saveAndUpgradeUnavailable"));
      return { ok: false, reason: saved?.reason || reason };
    }
    onState({ reason: "saved" });
    const upgrade = await requestUpgrade();
    return { ...upgrade, saved: true };
  }

  return { showIfWaiting, handleUpdateFound, requestUpgrade, saveAndUpgrade };
}

export function setupServiceWorkerUpgrade({
  navigatorObject = globalThis.navigator,
  documentObject = globalThis.document,
  windowObject = globalThis,
  reload = () => globalThis.location?.reload(),
  isDirty,
  toast,
  translateMessage,
  onSaveDraft,
  onWarning = (error) => console.warn("PWA registration failed", error)
} = {}) {
  const serviceWorker = navigatorObject?.serviceWorker;
  if (!serviceWorker?.register) return Promise.resolve(null);
  const banner = documentObject?.querySelector?.("#update-banner");
  const button = documentObject?.querySelector?.("#update-button");
  const saveButton = documentObject?.querySelector?.("#save-upgrade-button");
  const status = documentObject?.querySelector?.("#update-status");
  let reloading = false;
  let currentState = { reason: "ready" };
  const renderState = (state) => {
    currentState = state;
    const messageKeys = { dirty: "banner.updateDirty", saving: "banner.saveAndUpgradeBusy", save_failed: "banner.saveAndUpgradeFailed", save_cancelled: "banner.saveAndUpgradeCancelled", saved: "banner.draftSaved" };
    const messageKey = messageKeys[state.reason];
    if (banner?.dataset) banner.dataset.upgradeState = state.reason;
    if (status) {
      status.textContent = messageKey ? translate(translateMessage, messageKey) : "";
      status.classList?.toggle?.("hidden", !messageKey);
    }
    [button, saveButton].filter(Boolean).forEach((control) => {
      if (messageKey) control.setAttribute?.("aria-describedby", "update-status");
      else control.removeAttribute?.("aria-describedby");
    });
  };
  windowObject?.addEventListener?.("printform:ui-locale", () => renderState(currentState));
  serviceWorker.addEventListener?.("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    reload();
  });
  return Promise.resolve(serviceWorker.register("./sw.js")).then((registration) => {
    const controller = createServiceWorkerUpgradeController({ registration, serviceWorker, banner, button, saveButton, isDirty, toast, translateMessage, onSaveDraft, onWarning, onState: renderState });
    registration.addEventListener?.("updatefound", controller.handleUpdateFound);
    controller.showIfWaiting();
    button?.addEventListener?.("click", () => { void controller.requestUpgrade(); });
    saveButton?.addEventListener?.("click", () => { void controller.saveAndUpgrade(); });
    return registration;
  }).catch((error) => {
    onWarning(error);
    return null;
  });
}
