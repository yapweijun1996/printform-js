import { createStandaloneHtml } from "../core/exporter.js";

const OVERLAY_COMMAND_SOURCE = "printform-studio-v2-command";

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
export const buildPreviewBridge = (revision, overlayEnabled, token) => `<script>
(function () {
  "use strict";
  var overlayEnabled = ${overlayEnabled ? "true" : "false"};
  var lastIssues = [];

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
    parent.postMessage({ source: "printform-studio-v2-preview", type: "rendered", revision: ${revision}, token: ${JSON.stringify(token)}, payload: event.detail }, "*");
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
export async function renderPreview(iframe, project, revision, overlayEnabled = true, token = revision) {
  const result = await createStandaloneHtml(project, { requireTrusted: false, networkDisabled: true });
  // Inject at the LAST </body>: sample data / template sections are serialized
  // before the real closing tag, so replacing the first occurrence would let a
  // data value containing the literal text "</body>" corrupt the JSON block.
  const marker = "</body>";
  const at = result.html.lastIndexOf(marker);
  const injected = buildPreviewBridge(revision, overlayEnabled, token);
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
