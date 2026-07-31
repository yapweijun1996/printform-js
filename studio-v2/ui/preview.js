import { createStandaloneHtml } from "../core/exporter.js";

const bridge = (revision) => `<script>
window.addEventListener("printform:rendered", function (event) {
  parent.postMessage({ source: "printform-studio-v2-preview", type: "rendered", revision: ${revision}, payload: event.detail }, "*");
});
window.addEventListener("error", function (event) {
  parent.postMessage({ source: "printform-studio-v2-preview", type: "error", revision: ${revision}, payload: { message: event.message } }, "*");
});
</script>`;

export async function renderPreview(iframe, project, revision) {
  const result = await createStandaloneHtml(project, { requireTrusted: false, networkDisabled: true });
  // Inject at the LAST </body>: sample data / template sections are serialized
  // before the real closing tag, so replacing the first occurrence would let a
  // data value containing the literal text "</body>" corrupt the JSON block.
  const marker = "</body>";
  const at = result.html.lastIndexOf(marker);
  iframe.srcdoc = at === -1
    ? result.html + bridge(revision)
    : result.html.slice(0, at) + bridge(revision) + result.html.slice(at);
  return result;
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
