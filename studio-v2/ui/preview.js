import { createStandaloneHtml } from "../core/exporter.js";

const OVERLAY_COMMAND_SOURCE = "printform-studio-v2-command";
export const PREVIEW_SCRIPT_NONCE = "cHJpbnRmb3JtLXN0dWRpby12Mi1wcmV2aWV3LTIwMjY";

// Draws a red box over each flagged element using the issue's page-scoped
// selector, re-measured live inside the iframe (postMessage payloads cannot
// carry DOM references, only the plain data acceptance.js computed). Runs
// entirely inside the sandboxed iframe — no parent round-trip needed to see
// a box appear.
//
// `token` identifies THIS render request and is echoed back verbatim in
// every postMessage reply. A full srcdoc reload destroys the previous
// bridge's window/JS context, but the parent can't rely on that alone for
// ordering — the caller (app.js) uses the echoed token to match a reply to
// its own request and drop anything stale, whether the reply is for the
// human-edit committed-state render or an agent's candidate preview.
// Exported (not just used locally) so the token-echoing logic — pure string
// templating with no DOM/network dependency — can be unit tested directly.
// createStandaloneHtml (the rest of renderPreview) needs a real fetch of the
// dist/ runtime sources and only runs in a real browser; that part is
// covered by e2e instead.
export const buildPreviewBridge = (revision, overlayEnabled, token, options = {}) => `<script nonce="${PREVIEW_SCRIPT_NONCE}">
(function () {
  "use strict";
  var overlayEnabled = ${overlayEnabled ? "true" : "false"};
  var capturePixels = ${options.capturePixels === true ? "true" : "false"};
  var allowSyntheticPixels = ${options.allowSyntheticPixels === true ? "true" : "false"};
  var lastIssues = [];

  function pageSize(page) {
    var rect = page.getBoundingClientRect();
    return {
      width: Math.max(1, Math.ceil(Math.max(page.scrollWidth || 0, page.offsetWidth || 0, rect.width || 0))),
      height: Math.max(1, Math.ceil(Math.max(page.scrollHeight || 0, page.offsetHeight || 0, rect.height || 0)))
    };
  }

  function visibleColor(value) {
    return value && value !== "transparent" && value !== "rgba(0, 0, 0, 0)" ? value : "";
  }

  function paintText(context, node, rect, style, offset) {
    var text = (node.textContent || "").replace(/\\s+/g, " ").trim();
    if (!text || !visibleColor(style.color)) return;
    var size = Math.max(6, parseFloat(style.fontSize) || 12);
    var lineHeight = parseFloat(style.lineHeight) || size * 1.25;
    var padding = parseFloat(style.paddingLeft) || 0;
    var maxWidth = Math.max(1, rect.width - padding - (parseFloat(style.paddingRight) || 0));
    context.font = (style.fontStyle || "normal") + " " + (style.fontWeight || "400") + " " + size + "px " + (style.fontFamily || "Arial");
    context.fillStyle = style.color;
    context.textBaseline = "top";
    var words = text.split(" ");
    var line = "";
    var lines = [];
    words.forEach(function (word) {
      var next = line ? line + " " + word : word;
      if (line && context.measureText(next).width > maxWidth) { lines.push(line); line = word; } else line = next;
    });
    if (line) lines.push(line);
    var x = rect.left + padding;
    var y = rect.top + offset + (parseFloat(style.paddingTop) || 0);
    lines.slice(0, Math.max(1, Math.floor(rect.height / lineHeight) + 1)).forEach(function (item, index) {
      context.fillText(item, x, y + index * lineHeight, maxWidth);
    });
  }

  function paintNode(context, node, pageRect, offset, drawImages) {
    if (node.nodeType !== 1 || /^(SCRIPT|STYLE|TEMPLATE)$/.test(node.tagName)) return;
    var style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return;
    var box = node.getBoundingClientRect();
    var rect = { left: box.left - pageRect.left, top: box.top - pageRect.top, width: box.width, height: box.height };
    var background = visibleColor(style.backgroundColor);
    if (background && rect.width > 0 && rect.height > 0) { context.fillStyle = background; context.fillRect(rect.left, rect.top + offset, rect.width, rect.height); }
    var border = visibleColor(style.borderTopColor);
    if (border && parseFloat(style.borderTopWidth) > 0) { context.fillStyle = border; context.fillRect(rect.left, rect.top + offset, rect.width, parseFloat(style.borderTopWidth)); }
    if (node.tagName === "IMG" && rect.width > 0 && rect.height > 0) {
      var painted = false;
      if (drawImages && node.complete && node.naturalWidth) { try { context.drawImage(node, rect.left, rect.top + offset, rect.width, rect.height); painted = true; } catch (e) {} }
      if (!painted) { context.fillStyle = "#dce7fb"; context.fillRect(rect.left, rect.top + offset, rect.width, rect.height); context.strokeStyle = "#8ca4d1"; context.strokeRect(rect.left, rect.top + offset, rect.width, rect.height); }
    }
    if (!node.children.length) paintText(context, node, rect, style, offset);
    Array.prototype.forEach.call(node.children, function (child) { paintNode(context, child, pageRect, offset, drawImages); });
  }

  function capturePixelSnapshot() {
    return new Promise(function (resolve, reject) {
      if (!allowSyntheticPixels) {
        reject({ code: "PIXEL_EVIDENCE_SYNTHETIC_ONLY" });
        return;
      }
      if (!window.HTMLCanvasElement || !window.Image) {
        reject({ code: "PIXEL_CAPTURE_NO_CANVAS" });
        return;
      }
      var pages = Array.prototype.slice.call(document.querySelectorAll(".printform_page")).slice(0, 100);
      if (!pages.length) {
        reject({ code: "PIXEL_CAPTURE_NO_PAGES" });
        return;
      }
      var sizes = pages.map(pageSize);
      var width = Math.max.apply(null, sizes.map(function (size) { return size.width; }));
      var gap = 18;
      var height = sizes.reduce(function (total, size) { return total + size.height; }, 0) + gap * (sizes.length - 1);
      var scale = Math.min(1, 1800 / width, Math.sqrt(6000000 / Math.max(1, width * height)));
      function renderCanvas(drawImages) {
        var canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.ceil(width * scale));
        canvas.height = Math.max(1, Math.ceil(height * scale));
        var context = canvas.getContext("2d");
        if (!context) return null;
        context.scale(scale, scale); context.fillStyle = "#edf2f9"; context.fillRect(0, 0, width, height);
        var offset = 0;
        pages.forEach(function (page, index) {
          var size = sizes[index];
          var pageRect = page.getBoundingClientRect();
          context.fillStyle = "#ffffff"; context.fillRect(0, offset, size.width, size.height);
          paintNode(context, page, pageRect, offset, drawImages);
          offset += size.height + gap;
        });
        return canvas;
      }
      var canvas = renderCanvas(true);
      if (!canvas) { reject({ code: "PIXEL_CAPTURE_NO_CONTEXT" }); return; }
      try {
        var dataUrl = canvas.toDataURL("image/png");
        if (dataUrl.length > 5000000) dataUrl = canvas.toDataURL("image/jpeg", 0.84);
        resolve({ source: "sandbox-pixel", syntheticData: true, redacted: false, mimeType: dataUrl.slice(5, dataUrl.indexOf(";")), dataUrl: dataUrl, width: canvas.width, height: canvas.height, pageCount: pages.length });
      } catch (e) {
        canvas = renderCanvas(false);
        try {
          var safeDataUrl = canvas.toDataURL("image/png");
          resolve({ source: "sandbox-pixel", syntheticData: true, redacted: false, mimeType: "image/png", dataUrl: safeDataUrl, width: canvas.width, height: canvas.height, pageCount: pages.length });
        } catch (fallbackError) { reject({ code: "PIXEL_CAPTURE_EXPORT" }); }
      }
    });
  }

  function postRendered(payload) {
    parent.postMessage({ source: "printform-studio-v2-preview", type: "rendered", revision: ${revision}, token: ${JSON.stringify(token)}, payload: payload }, "*");
  }

  window.addEventListener("wheel", function (event) {
    if (event.ctrlKey || event.deltaX !== 0 || event.deltaY === 0) return;
    parent.postMessage({ source: "printform-studio-v2-preview", type: "wheel", payload: { deltaY: event.deltaY, ctrlKey: event.ctrlKey } }, "*");
  });

  function clearOverlays() {
    var nodes = document.querySelectorAll(".pf-issue-overlay");
    for (var i = 0; i < nodes.length; i += 1) nodes[i].remove();
  }

  function drawOverlays() {
    clearOverlays();
    if (!overlayEnabled || !lastIssues.length) return;
    var pages = document.querySelectorAll(".printform_page");
    lastIssues.forEach(function (issue) {
      var page = pages[issue.pageIndex];
      if (!page) return;
      var target = null;
      try { target = page.querySelector(issue.selector); } catch (e) { target = null; }
      if (!target) return;
      if (getComputedStyle(page).position === "static") page.style.position = "relative";
      var pageRect = page.getBoundingClientRect();
      var targetRect = target.getBoundingClientRect();
      var marker = document.createElement("div");
      marker.className = "pf-issue-overlay";
      marker.setAttribute("data-pf-issue-code", issue.code);
      marker.title = issue.code + (issue.text ? ": " + issue.text : "");
      marker.style.cssText = "position:absolute;pointer-events:none;z-index:2147483647;" +
        "box-sizing:border-box;border:2px solid #e11d2f;background:rgba(225,29,47,0.14);";
      marker.style.left = (targetRect.left - pageRect.left) + "px";
      marker.style.top = (targetRect.top - pageRect.top) + "px";
      marker.style.width = Math.max(targetRect.width, 2) + "px";
      marker.style.height = Math.max(targetRect.height, 2) + "px";
      page.appendChild(marker);
    });
  }

  window.addEventListener("printform:rendered", function (event) {
    lastIssues = (event.detail && event.detail.issues) || [];
    drawOverlays();
    if (!capturePixels) { postRendered(event.detail); return; }
    capturePixelSnapshot().then(function (snapshot) {
      postRendered(Object.assign({}, event.detail, { pixelSnapshot: snapshot }));
    }).catch(function (error) {
      postRendered(Object.assign({}, event.detail, { pixelCapture: { code: error.code || "PIXEL_CAPTURE_UNAVAILABLE" } }));
    });
  });

  window.addEventListener("message", function (event) {
    // Sandboxed iframe has an opaque origin, so identity is the sender
    // window, not event.origin — same pattern as the outbound preview
    // report the parent already verifies.
    if (event.source !== window.parent) return;
    var data = event.data;
    if (!data || data.source !== "${OVERLAY_COMMAND_SOURCE}") return;
    if (data.type === "toggle-overlay") {
      overlayEnabled = !!data.enabled;
      drawOverlays();
    }
  });

  window.addEventListener("error", function (event) {
    parent.postMessage({ source: "printform-studio-v2-preview", type: "error", revision: ${revision}, token: ${JSON.stringify(token)}, payload: { message: event.message } }, "*");
  });
})();
</script>`;

// `token` defaults to `revision` so any caller that doesn't need request
// disambiguation (there's only ever one committed project at a time) can
// omit it; app.js always passes an explicit one shared with its candidate
// requests so both compete in the same ordering space.
export async function renderPreview(iframe, project, revision, overlayEnabled = true, token = revision, options = {}) {
  const result = await createStandaloneHtml(project, { requireTrusted: false, networkDisabled: true, scriptNonce: PREVIEW_SCRIPT_NONCE });
  // Inject at the LAST </body>: sample data / template sections are serialized
  // before the real closing tag, so replacing the first occurrence would let a
  // data value containing the literal text "</body>" corrupt the JSON block.
  const marker = "</body>";
  const at = result.html.lastIndexOf(marker);
  const injected = buildPreviewBridge(revision, overlayEnabled, token, options);
  iframe.srcdoc = at === -1
    ? result.html + injected
    : result.html.slice(0, at) + injected + result.html.slice(at);
  return result;
}

// Live-toggles the overlay without a full reload — the iframe already holds
// the last render's issues, so this is instant and never re-runs pagination.
export function setPreviewOverlayEnabled(iframe, enabled) {
  iframe.contentWindow?.postMessage({ source: OVERLAY_COMMAND_SOURCE, type: "toggle-overlay", enabled }, "*");
}

export function listenForPreview(iframe, callback) {
  const listener = (event) => {
    // The payload "source" string is spoofable by any window that holds a
    // handle to Studio; identity must be the sender window itself. The iframe
    // is sandboxed (opaque origin, event.origin === "null"), so compare
    // event.source against the frame's contentWindow.
    if (!iframe.contentWindow || event.source !== iframe.contentWindow) return;
    if (event.data?.source === "printform-studio-v2-preview") callback(event.data);
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}
