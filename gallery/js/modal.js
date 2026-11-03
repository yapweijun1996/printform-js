import { currentLanguage, pageCount, text, typeName } from "./i18n.js";
import { createDialog } from "../shared/dialog.js";
import { adaptEmbeddedPreview } from "./embedded-preview.js";

export function createModal(dialog, manifest) {
  let frame = dialog.querySelector("iframe");
  const title = dialog.querySelector("#modal-title");
  const meta = dialog.querySelector("#modal-meta");
  const open = dialog.querySelector("[data-open]");
  const print = dialog.querySelector("[data-print]");
  const studio = dialog.querySelector("[data-studio]");
  const status = dialog.querySelector(".preview-status");
  let returnFocus, currentDesign, framePoll, stopWatching = () => {}, designUrl = "", state = "previewLoading", session = 0;
  const primitive = createDialog(dialog, () => {
    const card = [...document.querySelectorAll(".gallery-card")].find((node) => node.dataset.designId === returnFocus?.dataset.designId);
    return returnFocus?.isConnected ? returnFocus : card || document.querySelector("#search");
  });
  function cancelPoll() { clearTimeout(framePoll); framePoll = null; }
  function ready(candidate) {
    const win = candidate.contentWindow;
    if (win.__printFormProcessed !== true) return false;
    if (typeof win.SCHOOL_READY === "boolean") {
      return win.SCHOOL_READY && !candidate.contentDocument.querySelector("#print")?.disabled;
    }
    return true;
  }
  function showStatus(next) {
    state = next;
    status.hidden = !next;
    status.textContent = next ? text(next) : "";
  }
  function localize() {
    if (!currentDesign) return;
    title.textContent = `${currentDesign.no} · ${currentDesign.title[currentLanguage()]}`;
    meta.textContent = `${typeName(currentDesign.type)} · ${currentDesign.style[currentLanguage()]} · ${currentDesign.paper} · ${pageCount(currentDesign.pages)}`;
    open.textContent = text("openDesign");
    studio.textContent = text("openStudio");
    showStatus(state);
    try { if (dialog.open && new URL(frame.contentWindow.location.href).pathname === new URL(designUrl).pathname) adaptEmbeddedPreview(frame.contentDocument, currentLanguage()); } catch { /* Preview remains recoverable. */ }
  }
  function bindPreviewFrame(candidate, owner) {
    const active = () => dialog.open && owner === session && frame === candidate;
    candidate.addEventListener("load", () => {
      if (!active()) return;
      try { if (candidate.contentWindow.location.href !== designUrl) return; }
      catch { showStatus("previewError"); return; }
      cancelPoll();
      stopWatching();
      const doc = candidate.contentDocument;
      const sourcePrint = doc.querySelector("#print");
      const sourceStatus = doc.querySelector("#status");
      const school = typeof candidate.contentWindow.SCHOOL_READY === "boolean" && sourcePrint && sourceStatus;
      const sync = () => {
        if (!active()) return;
        try {
          print.disabled = !ready(candidate);
          showStatus(print.disabled ? (candidate.contentWindow.SCHOOL_ERROR ? "previewError" : "previewLoading") : "");
        } catch { print.disabled = true; showStatus("previewError"); }
      };
      if (school) {
        const onChange = (event) => {
          if (event.target.matches("#paper, #sample")) {
            print.disabled = true;
            showStatus("previewLoading");
          }
        };
        const observer = new MutationObserver(sync);
        observer.observe(sourcePrint, { attributes: true, attributeFilter: ["disabled"] });
        observer.observe(sourceStatus, { childList: true, characterData: true, subtree: true });
        doc.addEventListener("change", onChange, true);
        stopWatching = () => { observer.disconnect(); doc.removeEventListener("change", onChange, true); };
      }
      const started = Date.now();
      const poll = () => {
        if (!active()) return;
        try {
          adaptEmbeddedPreview(candidate.contentDocument, currentLanguage());
          primitive.bindFrame(candidate.contentDocument);
          if (ready(candidate)) { sync(); return; }
          if (candidate.contentWindow.SCHOOL_ERROR) { sync(); return; }
        } catch { /* A failed/cross-origin load keeps the recoverable action. */ }
        if (Date.now() - started >= 10000) { showStatus("previewError"); return; }
        framePoll = setTimeout(poll, 100);
      };
      poll();
    });
    candidate.addEventListener("error", () => {
      if (active()) { cancelPoll(); print.disabled = true; showStatus("previewError"); }
    });
  }
  print.addEventListener("click", () => {
    try {
      if (!dialog.open || print.disabled || !ready(frame)) {
        print.disabled = true;
        showStatus(frame.contentWindow.SCHOOL_ERROR ? "previewError" : "previewLoading");
        return;
      }
    } catch { print.disabled = true; showStatus("previewError"); return; }
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch { window.open(designUrl, "_blank", "noopener"); }
  });
  dialog.addEventListener("close", () => {
    if (dialog.open) return;
    session++;
    cancelPoll();
    stopWatching();
    print.disabled = true;
    frame.contentWindow.location.replace("about:blank");
    currentDesign = null;
  });
  document.addEventListener("gallery-language-change", localize);
  return {
    show(design, trigger) {
      session++;
      stopWatching();
      primitive.bindFrame(null);
      const previousFrame = frame;
      frame = previousFrame.cloneNode(false);
      bindPreviewFrame(frame, session);
      previousFrame.replaceWith(frame);
      cancelPoll();
      print.disabled = true;
      returnFocus = trigger;
      currentDesign = design;
      designUrl = new URL(`../${design.file}`, import.meta.url).href;
      open.href = designUrl;
      const safeStudio = design.studioUrl && /^\.\/studio-v3(?:\/|$)/.test(design.studioUrl);
      studio.hidden = !safeStudio;
      if (safeStudio) studio.href = new URL(`../${design.studioUrl.slice(2)}`, document.baseURI).href;
      showStatus("previewLoading");
      localize();
      primitive.open();
      // replace avoids adding iframe entries to Gallery's filter history.
      frame.contentWindow.location.replace(designUrl);
      const owner = session;
      framePoll = setTimeout(() => { if (dialog.open && owner === session) showStatus("previewError"); }, 12000);
    }
  };
}
