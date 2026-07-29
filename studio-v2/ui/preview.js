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
  iframe.srcdoc = result.html.replace("</body>", `${bridge(revision)}</body>`);
  return result;
}

export function listenForPreview(callback) {
  const listener = (event) => {
    if (event.data?.source === "printform-studio-v2-preview") callback(event.data);
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}
