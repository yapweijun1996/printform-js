const recentWheel = new WeakMap();

export function bindHorizontalWheel(viewport) {
  if (!viewport) return () => {};

  function onWheel(event) {
    const consumed = scrollHorizontally(viewport, { deltaX: event.deltaX, deltaY: event.deltaY, ctrlKey: event.ctrlKey, source: "parent" });
    if (consumed) event.preventDefault();
  }

  viewport.addEventListener("wheel", onWheel, { passive: false });
  return () => viewport.removeEventListener("wheel", onWheel);
}

export function bindPreviewWheel(viewport) {
  return bindHorizontalWheel(viewport);
}

export function scrollHorizontally(viewport, { deltaX = 0, deltaY = 0, ctrlKey = false, source = "unknown" } = {}) {
  if (!viewport || ctrlKey || deltaX !== 0 || deltaY === 0) return false;
  const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;
  if (maxScrollLeft <= 0) return false;
  const now = typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
  const previous = recentWheel.get(viewport);
  if (previous && previous.source !== source && previous.deltaY === deltaY && now - previous.at < 24) return false;
  const before = viewport.scrollLeft;
  const next = Math.max(0, Math.min(maxScrollLeft, before + deltaY));
  if (next === before) return false;
  viewport.scrollLeft = next;
  recentWheel.set(viewport, { at: now, deltaY, source });
  return true;
}

export function scrollPreviewHorizontally(viewport, options) {
  return scrollHorizontally(viewport, options);
}
