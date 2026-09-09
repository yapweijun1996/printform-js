import { escapeAttribute } from "./studio-dom.js";

export function createPreviewController(app) {
  const { state } = app;
  const reloadTimers = { A: null, B: null };
  const logBuffers = { A: [], B: [] };

  function clearLogs(side) {
    logBuffers[side] = [];
    renderLogs();
  }

  function addLog(side, entry) {
    logBuffers[side].push(entry);
    renderLogs();
  }

  function renderLogs() {
    const view = app.$("#log-view");
    const lines = [];
    const sides = state.compare ? ["A", "B"] : [state.activeSide === "B" ? "B" : "A"];
    sides.forEach((side) => {
      logBuffers[side].forEach((entry) => {
        const prefix = state.compare ? `[${side}] ` : "";
        const level = ["log", "info", "warn", "error"].includes(entry.level) ? entry.level : "log";
        lines.push(`<div class="${level}">${prefix}${escapeAttribute(entry.text)}</div>`);
      });
    });
    view.innerHTML = lines.join("");
    view.scrollTop = view.scrollHeight;
  }

  function renderMetrics() {
    const metrics = state.metrics[state.compare ? state.activeSide : "A"];
    app.$("#m-logical").textContent = metrics ? metrics.logicalPages : "–";
    app.$("#m-physical").textContent = metrics ? metrics.physicalPages : "–";
  }

  function reload(side) {
    const html = state.viewMode === "structure"
      ? app.synthesizeStructureHtml(side)
      : app.synthesizeHtml(side, false);
    if (html === null) return;
    const frame = side === "A" ? app.$("#frame-a") : app.$("#frame-b");
    const status = side === "A" ? app.$("#status-a") : app.$("#status-b");
    status.textContent = app.t("loading");
    frame.removeAttribute("src");
    frame.srcdoc = "";
    frame.srcdoc = html;
    clearLogs(side);
    applyPreviewScale(side);
  }

  function scheduleReload(side) {
    clearTimeout(reloadTimers[side]);
    reloadTimers[side] = setTimeout(() => reload(side), 300);
  }

  function reloadAll() {
    reload("A");
    if (state.compare) reload("B");
  }

  function getPaperWidthForSide(side) {
    const descriptor = state.descriptors.find((item) => item.htmlAttr === "data-papersize-width");
    const fallback = 750;
    if (!descriptor) return fallback;
    const overrides = state.overrides[side];
    let raw;
    if (Object.prototype.hasOwnProperty.call(overrides, descriptor.htmlAttr)) raw = overrides[descriptor.htmlAttr];
    else if (Object.prototype.hasOwnProperty.call(state.templateBaseline, descriptor.htmlAttr)) raw = state.templateBaseline[descriptor.htmlAttr];
    else raw = descriptor.defaultValue;
    const width = parseFloat(raw);
    return width > 0 ? width : fallback;
  }

  function applyPreviewScale(side) {
    const frame = side === "A" ? app.$("#frame-a") : app.$("#frame-b");
    const sizer = side === "A" ? app.$("#sizer-a") : app.$("#sizer-b");
    const viewport = side === "A" ? app.$("#viewport-a") : app.$("#viewport-b");
    const zoom = side === "A" ? app.$("#zoom-a") : app.$("#zoom-b");
    if (!frame || !sizer || !viewport) return;
    const naturalWidth = getPaperWidthForSide(side);
    const metrics = state.metrics[side];
    const naturalHeight = metrics && metrics.docHeight ? metrics.docHeight : naturalWidth * 1.4;
    const available = viewport.clientWidth - 32;
    let scale = available > 0 ? Math.min(1, available / naturalWidth) : 1;
    if (!isFinite(scale) || scale <= 0) scale = 1;
    frame.style.width = `${naturalWidth}px`;
    frame.style.height = `${naturalHeight}px`;
    frame.style.transform = `scale(${scale})`;
    sizer.style.width = `${Math.round(naturalWidth * scale)}px`;
    sizer.style.height = `${Math.round(naturalHeight * scale)}px`;
    if (zoom) zoom.textContent = `${Math.round(scale * 100)}%`;
  }

  function setupPreviewScaling() {
    ["A", "B"].forEach((side) => {
      const viewport = side === "A" ? app.$("#viewport-a") : app.$("#viewport-b");
      if (!viewport || typeof ResizeObserver === "undefined") return;
      new ResizeObserver(() => applyPreviewScale(side)).observe(viewport);
    });
    window.addEventListener("resize", () => {
      applyPreviewScale("A");
      applyPreviewScale("B");
    });
  }

  window.addEventListener("message", (event) => {
    if (event.origin !== location.origin) return;
    const data = event.data;
    if (!data || data.source !== "printform-studio-bridge") return;
    const side = data.side === "B" ? "B" : "A";
    const sourceFrame = side === "B" ? app.$("#frame-b") : app.$("#frame-a");
    if (!sourceFrame || event.source !== sourceFrame.contentWindow) return;
    if (data.type === "console") {
      logBuffers[side].push(data.payload);
      if (logBuffers[side].length > 500) logBuffers[side].shift();
      renderLogs();
    } else if (data.type === "done") {
      state.metrics[side] = data.payload;
      const status = side === "A" ? app.$("#status-a") : app.$("#status-b");
      status.textContent = `${data.payload.logicalPages} ${app.t("pages")}`;
      renderMetrics();
      applyPreviewScale(side);
    } else if (data.type === "blocks-ready") {
      state.blockCount = data.payload.count;
      state.rowCount = data.payload.rowCount;
      const range = app.$("#row-count-range");
      range.disabled = false;
      range.max = Math.max(10, state.rowCount + 20);
      range.value = state.rowCount;
      app.$("#row-count-value").textContent = state.rowCount;
      const status = side === "A" ? app.$("#status-a") : app.$("#status-b");
      status.textContent = `${data.payload.count} ${app.t("blocks")}`;
      const frame = side === "A" ? app.$("#frame-a") : app.$("#frame-b");
      const doc = frame && frame.contentDocument;
      if (doc) {
        state.metrics[side] = state.metrics[side] || {};
        state.metrics[side].docHeight = doc.documentElement.scrollHeight;
      }
      applyPreviewScale(side);
    } else if (data.type === "block-select") {
      state.selectedBlockIndex = data.payload.index;
      state.selectedBlockSide = side;
      app.$("#be-selected").style.display = "";
      app.$("#be-type").textContent = data.payload.type;
      app.$("#be-html").value = data.payload.outerHTML;
      const isRow = data.payload.type === "prowitem";
      app.$("#be-duplicate").disabled = !isRow;
      app.$("#be-delete").disabled = !isRow;
    }
  });

  return { addLog, clearLogs, renderLogs, renderMetrics, reload, reloadAll, scheduleReload, setupPreviewScaling };
}
