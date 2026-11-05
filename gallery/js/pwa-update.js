// One explicit user-action activation contract. Other tabs never force a reload.
const UPDATE_CHECK_TIMEOUT = 10000;
const INSTALL_WAIT_TIMEOUT = 25000;

// A timeout only bounds what the UI waits for. It cannot cancel a browser-managed
// service-worker install, so a late install event remains observable by watch().
function bounded(promise, timeout, message) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => { settled = true; reject(new Error(message)); }, timeout);
    Promise.resolve(promise).then((value) => {
      if (settled) return;
      settled = true; clearTimeout(timer); resolve(value);
    }, (error) => {
      if (settled) return;
      settled = true; clearTimeout(timer); reject(error);
    });
  });
}

export function createUpdater({ serviceWorker, scope, running, online, busy, render, reload, fetchLatest }) {
  let registration, target, state = "checking", checking, starting, activating = false, reloaded = false, timer;
  let pendingWorker;
  const watched = new WeakSet();
  let offerSequence = 0;
  function publish(next = state) {
    state = next;
    render({ state, available: target?.build || "", checking: Boolean(checking || starting), activating, blocked: busy() });
  }
  function identity(worker) {
    return new Promise((resolve, reject) => {
      if (!worker) { reject(new Error("Missing worker")); return; }
      const channel = new MessageChannel();
      const timeout = setTimeout(() => { channel.port1.close(); reject(new Error("Worker did not respond")); }, 3000);
      channel.port1.onmessage = ({ data }) => {
        clearTimeout(timeout); channel.port1.close();
        if (data?.type === "BUILD" && typeof data.build === "string" && /^[\w-]{1,80}$/.test(data.build)) resolve(data.build);
        else reject(new Error("Invalid build identity"));
      };
      try { worker.postMessage({ type: "GET_BUILD" }, [channel.port2]); }
      catch (error) { clearTimeout(timeout); channel.port1.close(); reject(error); }
    });
  }
  function waitForInstall(worker) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true; clearTimeout(timeout); worker.removeEventListener("statechange", changed); resolve(result);
      };
      const timeout = setTimeout(() => finish("timeout"), INSTALL_WAIT_TIMEOUT);
      function changed() {
        if (!["installed", "activated", "redundant"].includes(worker.state)) return;
        finish(worker.state === "redundant" ? "failed" : "installed");
      }
      worker.addEventListener("statechange", changed);
      changed();
    });
  }
  async function offer(worker, latest) {
    const sequence = ++offerSequence;
    const current = () => sequence === offerSequence && !activating &&
      worker === (registration.waiting || registration.active) && worker.state !== "redundant";
    try {
      const build = await identity(worker);
      if (!current()) return;
      // Legacy network-first navigation can load shell B while A still controls it.
      // Waiting B still needs explicit activation, even when B matches the shell.
      // Do not query A: the original worker has no GET_BUILD protocol.
      if (build !== running || worker === registration.waiting) {
        target = { build, worker }; publish("updateAvailable");
      } else { target = null; publish(latest && latest !== running ? "updateFailed" : "upToDate"); }
    } catch {
      if (current()) { target = null; publish("updateFailed"); }
    }
  }
  function watch(worker) {
    if (!worker) return;
    pendingWorker = worker;
    if (watched.has(worker)) return;
    watched.add(worker);
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed") offer(registration.waiting || worker);
      // registration.installing can be cleared before a late failure event.
      // Keep the observed worker identity so an older worker cannot overwrite a
      // newer pending/available worker's state.
      if (worker.state === "redundant" && worker === pendingWorker) {
        target = null; publish("updateFailed");
      }
    });
  }
  async function check() {
    if (checking || activating) return checking;
    if (!registration) return start();
    if (!online()) { publish("offline"); return; }
    // A late event from a previous check must not overwrite this check's result.
    pendingWorker = undefined;
    checking = (async () => {
      publish("checking");
      try {
        const latest = await fetchLatest();
        let worker = registration.installing;
        if (!worker) {
          try { await bounded(registration.update(), UPDATE_CHECK_TIMEOUT, "Update check timeout"); }
          catch (error) {
            // update() may remain pending while the browser has already started
            // installing. Continue observing that worker instead of reporting a
            // false metadata failure; only a worker-less timeout is a failure.
            if (!registration.installing && !registration.waiting) throw error;
          }
        }
        worker = registration.installing;
        if (worker) {
          watch(worker);
          publish("preparing");
          const result = await waitForInstall(worker);
          if (result === "timeout") { publish("preparingSlow"); return; }
          if (result === "failed") throw new Error("Install failed");
        }
        worker = registration.waiting || registration.active;
        if (!worker) throw new Error("No installed worker");
        await offer(worker, latest);
      } catch (error) { console.warn("Gallery update check failed", error); publish(online() ? "updateFailed" : "offline"); }
    })();
    publish();
    try { await checking; } finally { checking = null; publish(); }
  }
  function finish() {
    if (!activating || reloaded || serviceWorker.controller !== target?.worker) return;
    clearTimeout(timer);
    reloaded = true;
    reload();
  }
  async function activate() {
    if (!target || activating) return;
    if (!online()) { publish("offline"); return; }
    if (busy()) { publish("updateDeferred"); return; }
    activating = true;
    offerSequence++; // Invalidate identity replies from checks started before the action.
    publish("updating");
    timer = setTimeout(() => { activating = false; publish("updateFailed"); }, 10000);
    try {
      if (registration.waiting && await identity(registration.waiting) === target.build) {
        registration.waiting.postMessage({ type: "SKIP_WAITING", build: target.build });
      } else if (registration.active && await identity(registration.active) === target.build) finish();
      else throw new Error("Update no longer ready");
    } catch { clearTimeout(timer); activating = false; publish("updateFailed"); }
  }
  serviceWorker?.addEventListener("controllerchange", () => {
    if (activating) finish();
    else if (registration?.active) offer(registration.waiting || registration.active);
  });
  async function start() {
    if (starting) return starting;
    if (!serviceWorker) { publish("unsupported"); return; }
    starting = (async () => {
      try {
        const existing = await bounded(serviceWorker.getRegistration("./"), UPDATE_CHECK_TIMEOUT, "Registration lookup timeout");
        registration = existing && (!scope || existing.scope === scope) ? existing : await bounded(serviceWorker.register("./sw.js", { scope: "./", updateViaCache: "none" }), UPDATE_CHECK_TIMEOUT, "Registration timeout");
        pendingWorker = undefined;
        registration.addEventListener("updatefound", () => {
          watch(registration.installing);
          if (registration.installing && checking) publish("preparing");
        });
        watch(registration.installing);
        if (registration.waiting) await offer(registration.waiting);
        await check();
      } catch { publish(online() ? "updateFailed" : "offline"); }
    })();
    publish();
    try { await starting; } finally { starting = null; publish(); }
  }
  return { check, activate, start, refresh: () => publish() };
}
