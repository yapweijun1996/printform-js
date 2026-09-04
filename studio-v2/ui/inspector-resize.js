// Drag-to-resize for the docked inspector / AI Designer panel.
//
// The panel is anchored to the right edge (`position: fixed; inset: 0 0 0 auto`)
// and its width — plus the reserved gutter on `.topbar` / `.workspace` — is
// driven entirely by the `--inspector-width` custom property. Resizing is just
// writing that property (clamped + persisted); every dependent layout reflows
// for free. Only wired for the docked desktop layout (> 1080px); on narrower
// viewports the panel is a fixed-size overlay and the handle is hidden by CSS.

const STORAGE_KEY = "printform-studio-v2-inspector-width";
const DEFAULT_WIDTH = 420;
const MIN_WIDTH = 320;

function maxWidth() {
  return Math.min(Math.round(window.innerWidth * 0.7), 900);
}

function clamp(px) {
  return Math.round(Math.min(Math.max(px, MIN_WIDTH), maxWidth()));
}

function applyWidth(px) {
  document.documentElement.style.setProperty("--inspector-width", `${px}px`);
}

function storedWidth() {
  try {
    const raw = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  } catch { return null; }
}

function persist(px) {
  try { localStorage.setItem(STORAGE_KEY, String(px)); } catch { /* private storage can be unavailable */ }
}

export function bindInspectorResize({
  panel = document.getElementById("inspector-panel"),
  handle = document.getElementById("inspector-resize-handle"),
} = {}) {
  if (!panel || !handle) return null;

  let width = clamp(storedWidth() || DEFAULT_WIDTH);
  applyWidth(width);
  handle.setAttribute("aria-valuemin", String(MIN_WIDTH));

  function syncAria() {
    handle.setAttribute("aria-valuenow", String(width));
    handle.setAttribute("aria-valuemax", String(maxWidth()));
  }
  syncAria();

  function setWidth(next, { save = true } = {}) {
    width = clamp(next);
    applyWidth(width);
    syncAria();
    if (save) persist(width);
  }

  let dragging = false;

  function onMove(event) {
    if (!dragging) return;
    // Panel is pinned to the right edge, so its width is the distance from the
    // pointer to that edge.
    setWidth(window.innerWidth - event.clientX, { save: false });
  }

  function endDrag(event) {
    if (!dragging) return;
    dragging = false;
    try { handle.releasePointerCapture(event.pointerId); } catch { /* already released */ }
    document.body.classList.remove("is-resizing-inspector");
    persist(width);
  }

  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    dragging = true;
    try { handle.setPointerCapture(event.pointerId); } catch { /* unsupported */ }
    document.body.classList.add("is-resizing-inspector");
    event.preventDefault();
  });
  handle.addEventListener("pointermove", onMove);
  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", endDrag);
  handle.addEventListener("lostpointercapture", () => {
    dragging = false;
    document.body.classList.remove("is-resizing-inspector");
  });

  handle.addEventListener("dblclick", () => setWidth(DEFAULT_WIDTH));
  handle.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 48 : 16;
    if (event.key === "ArrowLeft") setWidth(width + step);
    else if (event.key === "ArrowRight") setWidth(width - step);
    else if (event.key === "Home") setWidth(maxWidth());
    else if (event.key === "End") setWidth(MIN_WIDTH);
    else return;
    event.preventDefault();
  });

  // Keep the width inside the (viewport-relative) clamp when the window changes.
  window.addEventListener("resize", () => setWidth(width, { save: false }));

  return { setWidth, reset: () => setWidth(DEFAULT_WIDTH) };
}
